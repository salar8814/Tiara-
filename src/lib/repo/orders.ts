import "server-only";
import { randomBytes } from "node:crypto";
import { storeRules } from "@/data/rules";
import { db, newId, now, tx } from "../db";
import { cartTotals, canUseEmployeePrice, unitPrice } from "../pricing";
import { orderTransitions } from "../status";
import type { Address, Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus, User } from "../types";
import { audit } from "./audit";
import { addEvent, listEvents, uniqueCode } from "./common";
import { InsufficientStockError, moveStock } from "./inventory";
import { getPurchasableVariants } from "./products";

// Concurrency model (ADR-003): every state change is a conditional UPDATE
// (`WHERE id = ? AND status = <expected>`) inside a BEGIN IMMEDIATE transaction,
// and side effects (stock release, events) run only if that UPDATE changed a row.
// Whoever loses a race changes nothing — so stock is released at most once.

/** Unpaid orders release their reserved stock after this window. */
export const PAYMENT_WINDOW_MIN = 30;
export const MAX_ORDER_LINES = 30;

interface OrderRow {
  id: string;
  code: string;
  user_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_ref: string | null;
  refund_ref: string | null;
  delivery_method: string;
  subtotal_retail: number;
  employee_discount: number;
  shipping: number;
  total: number;
  address: string | null;
  created_at: string;
  updated_at: string;
}

function hydrate(r: OrderRow): Order {
  const items = (
    db().prepare("SELECT * FROM order_items WHERE order_id = ?").all(r.id) as {
      product_id: string;
      variant_id: string;
      name: string;
      variant_label: string;
      qty: number;
      unit_retail: number;
      unit_price: number;
    }[]
  ).map<OrderItem>((i) => ({
    productId: i.product_id,
    variantId: i.variant_id,
    name: i.name,
    variantLabel: i.variant_label,
    qty: i.qty,
    unitRetail: i.unit_retail,
    unitPrice: i.unit_price,
  }));
  return {
    id: r.id,
    code: r.code,
    userId: r.user_id,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    paymentRef: r.payment_ref,
    refundRef: r.refund_ref,
    deliveryMethod: r.delivery_method,
    subtotalRetail: r.subtotal_retail,
    employeeDiscount: r.employee_discount,
    shipping: r.shipping,
    total: r.total,
    address: r.address ? JSON.parse(r.address) : null,
    items,
    events: listEvents("order", r.id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    public lineErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** A state change was refused because the order is no longer in the expected state. */
export class OrderStateError extends Error {}

export interface CheckoutInput {
  /** must be freshly resolved against HR (see refreshEligibility) */
  user: User;
  lines: { variantId: string; qty: number }[];
  deliveryMethod: string;
  address: Address | null;
  paymentMethod: PaymentMethod;
  /** client-generated per checkout attempt; replays return the original order */
  idempotencyKey?: string | null;
}

/** Sums duplicate lines so per-order caps apply to the variant, not to each line. */
export function mergeLines(lines: { variantId: string; qty: number }[]) {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.variantId, (m.get(l.variantId) ?? 0) + l.qty);
  return Array.from(m, ([variantId, qty]) => ({ variantId, qty }));
}

const paymentCutoff = (nowMs = Date.now()) => new Date(nowMs - PAYMENT_WINDOW_MIN * 60_000).toISOString();

/**
 * Creates an order in `pending_payment` and reserves stock atomically.
 * Prices, eligibility, product availability and caps are recomputed here.
 */
export function createOrder(input: CheckoutInput): Order {
  const { user } = input;
  if (!canUseEmployeePrice(user.eligibility)) {
    throw new CheckoutError("خرید از فروشگاه کارکنان فقط برای کارکنان واجد شرایط فعال است.");
  }
  const delivery = storeRules.deliveryMethods.find((d) => d.id === input.deliveryMethod);
  if (!delivery) throw new CheckoutError("روش تحویل نامعتبر است.");
  if (delivery.requiresAddress && !input.address) throw new CheckoutError("نشانی تحویل را انتخاب کنید.");
  if (input.address && input.address.userId !== user.id) throw new CheckoutError("نشانی انتخاب‌شده یافت نشد.");
  const merged = mergeLines(input.lines.filter((l) => Number.isInteger(l.qty) && l.qty > 0));
  if (merged.length === 0) throw new CheckoutError("سبد خرید خالی است.");
  if (merged.length > MAX_ORDER_LINES) throw new CheckoutError("تعداد اقلام سبد بیش از حد مجاز است.");
  const key = input.idempotencyKey && /^[A-Za-z0-9-]{8,64}$/.test(input.idempotencyKey) ? input.idempotencyKey : null;

  expireStaleOrders();

  const id = tx(() => {
    if (key) {
      const existing = db().prepare("SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ?").get(user.id, key) as { id: string } | undefined;
      if (existing) return existing.id;
    }
    const variants = getPurchasableVariants(merged.map((l) => l.variantId));
    const lineErrors: Record<string, string> = {};
    for (const l of merged) {
      const v = variants.get(l.variantId);
      if (!v) lineErrors[l.variantId] = "این کالا دیگر در فروشگاه موجود نیست.";
      else if (l.qty > v.maxPerOrder) lineErrors[l.variantId] = `سقف خرید این کالا ${v.maxPerOrder.toLocaleString("fa-IR")} عدد در هر سفارش است.`;
      else if (l.qty > v.stock) lineErrors[l.variantId] = v.stock === 0 ? "این کالا ناموجود شد." : `فقط ${v.stock.toLocaleString("fa-IR")} عدد موجود است.`;
    }
    if (Object.keys(lineErrors).length) throw new CheckoutError("برخی اقلام سبد نیاز به اصلاح دارند.", lineErrors);

    const lines = merged.map((l) => ({ v: variants.get(l.variantId)!, qty: l.qty }));
    const totals = cartTotals(lines.map((l) => ({ variant: l.v, qty: l.qty })), true, delivery.id);
    const orderId = newId();
    const code = uniqueCode(storeRules.orderCodePrefix, "orders");
    const ts = now();
    const address = input.address
      ? {
          recipient: input.address.recipient,
          mobile: input.address.mobile,
          province: input.address.province,
          city: input.address.city,
          street: input.address.street,
          plaque: input.address.plaque,
          unit: input.address.unit,
          postalCode: input.address.postalCode,
        }
      : null;
    db()
      .prepare(
        `INSERT INTO orders (id, code, user_id, status, payment_method, payment_status, payment_ref, delivery_method, subtotal_retail, employee_discount, shipping, total, address, idempotency_key, created_at, updated_at)
         VALUES (?, ?, ?, 'pending_payment', ?, 'unpaid', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(orderId, code, user.id, input.paymentMethod, delivery.id, totals.subtotalRetail, totals.employeeDiscount, totals.shipping, totals.total, address ? JSON.stringify(address) : null, key, ts, ts);

    const insItem = db().prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_label, qty, unit_retail, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const l of lines) {
      insItem.run(orderId, l.v.productId, l.v.id, l.v.productName, l.v.label, l.qty, l.v.retailPrice, unitPrice(l.v, true));
      try {
        moveStock(l.v.id, -l.qty, "reserve", `customer:${user.mobile}`, code);
      } catch (e) {
        if (e instanceof InsufficientStockError) throw new CheckoutError("موجودی تغییر کرد؛ دوباره تلاش کنید.", { [l.v.id]: "موجودی کافی نیست." });
        throw e;
      }
    }
    addEvent("order", orderId, "pending_payment", "سفارش ثبت شد و موجودی تا پایان مهلت پرداخت رزرو شد.", "customer");
    return orderId;
  });
  return getOrderById(id)!;
}

function releaseStock(orderId: string, code: string, actor: string) {
  const items = db().prepare("SELECT variant_id, qty FROM order_items WHERE order_id = ?").all(orderId) as { variant_id: string; qty: number }[];
  for (const i of items) moveStock(i.variant_id, i.qty, "release", actor, code);
}

/**
 * Cancels an order and releases its stock exactly once. Returns false (and does
 * nothing) when the order is not in one of `from` — e.g. it was already
 * cancelled by a concurrent expiry, or paid in the meantime.
 */
function cancelInternal(orderId: string, from: OrderStatus[], actor: string, note: string | null, olderThan?: string): boolean {
  return tx(() => {
    const row = db().prepare("SELECT code, payment_status FROM orders WHERE id = ?").get(orderId) as { code: string; payment_status: PaymentStatus } | undefined;
    if (!row) return false;
    // Paid money must be returned: a real payment becomes refund_pending; sandbox had no funds.
    const paymentAfter: PaymentStatus =
      row.payment_status === "paid" ? "refund_pending" : row.payment_status === "paid_sandbox" ? "refunded" : row.payment_status;
    const res = db()
      .prepare(
        `UPDATE orders SET status = 'cancelled', payment_status = ?, refund_ref = CASE WHEN ? = 'refunded' THEN 'SANDBOX-NO-FUNDS' ELSE refund_ref END, updated_at = ?
         WHERE id = ? AND status IN (${from.map(() => "?").join(",")}) ${olderThan ? "AND created_at < ?" : ""}`,
      )
      .run(paymentAfter, paymentAfter, now(), orderId, ...from, ...(olderThan ? [olderThan] : []));
    if (res.changes !== 1) return false;
    releaseStock(orderId, row.code, actor);
    addEvent("order", orderId, "cancelled", note, actor);
    if (paymentAfter === "refund_pending") addEvent("order", orderId, "refund_pending", "مبلغ پرداخت‌شده باید توسط واحد مالی بازگردانده شود.", actor);
    return true;
  });
}

/** Releases one stale order. Safe to call concurrently and repeatedly (see ADR-003). */
export function expireOrder(orderId: string, nowMs = Date.now()): boolean {
  return cancelInternal(orderId, ["pending_payment"], "system", "مهلت پرداخت به پایان رسید و رزرو موجودی آزاد شد.", paymentCutoff(nowMs));
}

/** Lazy expiry sweep. The candidate list may be stale; expireOrder re-checks each row under the write lock. */
export function expireStaleOrders(nowMs = Date.now()): number {
  const stale = db()
    .prepare("SELECT id FROM orders WHERE status = 'pending_payment' AND created_at < ?")
    .all(paymentCutoff(nowMs)) as { id: string }[];
  let n = 0;
  for (const s of stale) if (expireOrder(s.id, nowMs)) n++;
  return n;
}

export function getOrderById(id: string): Order | null {
  const r = db().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  return r ? hydrate(r) : null;
}

export function getOrderByCode(code: string): Order | null {
  expireStaleOrders();
  const r = db().prepare("SELECT * FROM orders WHERE code = ?").get(code) as OrderRow | undefined;
  return r ? hydrate(r) : null;
}

export function listOrders(userId?: string): Order[] {
  expireStaleOrders();
  const rows = (
    userId
      ? db().prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(userId)
      : db().prepare("SELECT * FROM orders ORDER BY created_at DESC").all()
  ) as OrderRow[];
  return rows.map(hydrate);
}

/**
 * Fulfilment / cancellation transitions. `paid` is deliberately NOT reachable
 * here: it can only be set by a payment function that records a reference.
 */
export function transitionOrder(id: string, to: OrderStatus, actor: string, note: string | null = null) {
  if (to === "paid" || to === "pending_payment") throw new OrderStateError(`"${to}" can only be set by the payment flow`);
  const o = getOrderById(id);
  if (!o) throw new OrderStateError("order not found");
  if (!orderTransitions[o.status].includes(to)) throw new OrderStateError(`invalid transition ${o.status} → ${to}`);
  if (to === "cancelled") {
    if (!cancelInternal(id, [o.status], actor, note)) throw new OrderStateError("order changed concurrently; reload and retry");
    return;
  }
  tx(() => {
    const res = db().prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?").run(to, now(), id, o.status);
    if (res.changes !== 1) throw new OrderStateError("order changed concurrently; reload and retry");
    addEvent("order", id, to, note, actor);
  });
}

/** Customer may cancel their own order only while it is unpaid. */
export function customerCancelOrder(user: User, code: string): boolean {
  const o = db().prepare("SELECT id, user_id FROM orders WHERE code = ?").get(code) as { id: string; user_id: string } | undefined;
  if (!o || o.user_id !== user.id) return false;
  return cancelInternal(o.id, ["pending_payment"], `customer:${user.mobile}`, "سفارش توسط مشتری لغو شد.");
}

/** Marks a payment received. Refuses expired, cancelled or already-paid orders. */
function markPaid(id: string, status: "paid" | "paid_sandbox", ref: string, actor: string, note: string, enforceWindow: boolean) {
  tx(() => {
    const res = db()
      .prepare(
        `UPDATE orders SET status = 'paid', payment_status = ?, payment_ref = ?, updated_at = ?
         WHERE id = ? AND status = 'pending_payment' AND payment_status IN ('unpaid','failed') ${enforceWindow ? "AND created_at >= ?" : ""}`,
      )
      .run(status, ref, now(), id, ...(enforceWindow ? [paymentCutoff()] : []));
    if (res.changes !== 1) throw new OrderStateError("order is not awaiting payment (expired, cancelled or already paid)");
    addEvent("order", id, "paid", note, actor);
  });
}

/**
 * Sandbox settlement — only reachable when PAYMENT_MODE=sandbox (refused in production).
 * Uses `paid_sandbox`, never `paid`, so test orders stay identifiable.
 */
export function settleSandboxPayment(id: string, outcome: "success" | "failure") {
  if (expireOrder(id)) throw new OrderStateError("payment window expired");
  if (outcome === "failure") {
    tx(() => {
      const res = db()
        .prepare("UPDATE orders SET payment_status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending_payment' AND payment_status IN ('unpaid','failed')")
        .run(now(), id);
      if (res.changes !== 1) throw new OrderStateError("order is not awaiting payment");
      addEvent("order", id, "payment_failed", "تراکنش آزمایشی ناموفق بود. می‌توانید دوباره تلاش کنید.", "payment-sandbox");
    });
    return;
  }
  const ref = `SANDBOX-${randomBytes(6).toString("hex").toUpperCase()}`;
  markPaid(id, "paid_sandbox", ref, "payment-sandbox", `پرداخت آزمایشی — بدون تراکنش واقعی (مرجع ${ref})`, true);
}

/**
 * Finance reconciles an offline payment (bank receipt). The reference is unique
 * across orders, so the same receipt cannot settle two orders.
 */
export function recordManualPayment(id: string, reference: string, actor: string) {
  const ref = reference.trim();
  if (!/^[\p{L}\p{N}\-_/ ]{4,64}$/u.test(ref)) throw new OrderStateError("invalid payment reference");
  try {
    tx(() => {
      markPaid(id, "paid", ref, actor, `پرداخت توسط واحد مالی تطبیق داده شد (مرجع ${ref})`, false);
      audit(actor, "payment.record", "order", id, null, { reference: ref });
    });
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new OrderStateError("this payment reference is already used by another order");
    throw e;
  }
}

/** Finance records that the money of a cancelled paid order was returned. */
export function recordRefund(id: string, reference: string, actor: string) {
  const ref = reference.trim();
  if (!/^[\p{L}\p{N}\-_/ ]{4,64}$/u.test(ref)) throw new OrderStateError("invalid refund reference");
  tx(() => {
    const res = db()
      .prepare("UPDATE orders SET payment_status = 'refunded', refund_ref = ?, updated_at = ? WHERE id = ? AND payment_status = 'refund_pending'")
      .run(ref, now(), id);
    if (res.changes !== 1) throw new OrderStateError("no refund is pending for this order");
    addEvent("order", id, "refunded", `مبلغ سفارش بازگردانده شد (مرجع ${ref})`, actor);
    audit(actor, "refund.record", "order", id, null, { reference: ref });
  });
}
