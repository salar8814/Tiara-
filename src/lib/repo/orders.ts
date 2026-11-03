import "server-only";
import { randomBytes } from "node:crypto";
import { storeRules } from "@/data/rules";
import { db, newId, now } from "../db";
import { cartTotals, canUseEmployeePrice, unitPrice } from "../pricing";
import { orderTransitions } from "../status";
import type { Address, Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus, User } from "../types";
import { addEvent, listEvents, uniqueCode } from "./common";
import { getVariants } from "./products";

/** Unpaid orders release their reserved stock after this window. */
export const PAYMENT_WINDOW_MIN = 30;

interface OrderRow {
  id: string;
  code: string;
  user_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_ref: string | null;
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

export interface CheckoutInput {
  user: User;
  lines: { variantId: string; qty: number }[];
  deliveryMethod: string;
  address: Address | null;
  paymentMethod: PaymentMethod;
}

/**
 * Creates an order in `pending_payment` and reserves stock atomically.
 * Prices, eligibility and limits are recomputed here from the database.
 */
export function createOrder(input: CheckoutInput): Order {
  const { user } = input;
  if (!canUseEmployeePrice(user.eligibility)) {
    throw new CheckoutError("خرید از فروشگاه کارکنان فقط برای کارکنان واجد شرایط فعال است.");
  }
  const delivery = storeRules.deliveryMethods.find((d) => d.id === input.deliveryMethod);
  if (!delivery) throw new CheckoutError("روش تحویل نامعتبر است.");
  if (delivery.requiresAddress && !input.address) throw new CheckoutError("نشانی تحویل را انتخاب کنید.");
  if (input.lines.length === 0) throw new CheckoutError("سبد خرید خالی است.");

  expireStaleOrders();

  const tx = db().transaction(() => {
    const variants = getVariants(input.lines.map((l) => l.variantId));
    const lineErrors: Record<string, string> = {};
    const resolved = input.lines.map((l) => {
      const v = variants.get(l.variantId);
      if (!v) {
        lineErrors[l.variantId] = "این کالا دیگر موجود نیست.";
        return null;
      }
      if (l.qty > v.maxPerOrder) lineErrors[l.variantId] = `سقف خرید این کالا ${v.maxPerOrder.toLocaleString("fa-IR")} عدد در هر سفارش است.`;
      else if (l.qty > v.stock)
        lineErrors[l.variantId] = v.stock === 0 ? "این کالا ناموجود شد." : `فقط ${v.stock.toLocaleString("fa-IR")} عدد موجود است.`;
      return { v, qty: l.qty };
    });
    if (Object.keys(lineErrors).length) throw new CheckoutError("برخی اقلام سبد نیاز به اصلاح دارند.", lineErrors);

    const lines = resolved.filter((x): x is NonNullable<typeof x> => x !== null);
    const totals = cartTotals(lines.map((l) => ({ variant: l.v, qty: l.qty })), true, delivery.id);
    const productNames = new Map(
      (
        db()
          .prepare(`SELECT id, name FROM products WHERE id IN (${lines.map(() => "?").join(",")})`)
          .all(...lines.map((l) => l.v.productId)) as { id: string; name: string }[]
      ).map((p) => [p.id, p.name]),
    );

    const id = newId();
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
        `INSERT INTO orders (id, code, user_id, status, payment_method, payment_status, payment_ref, delivery_method, subtotal_retail, employee_discount, shipping, total, address, created_at, updated_at)
         VALUES (?, ?, ?, 'pending_payment', ?, 'unpaid', NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, code, user.id, input.paymentMethod, delivery.id, totals.subtotalRetail, totals.employeeDiscount, totals.shipping, totals.total, address ? JSON.stringify(address) : null, ts, ts);

    const insItem = db().prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_label, qty, unit_retail, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const reserve = db().prepare("UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?");
    for (const l of lines) {
      insItem.run(id, l.v.productId, l.v.id, productNames.get(l.v.productId) ?? "", l.v.label, l.qty, l.v.retailPrice, unitPrice(l.v, true));
      const res = reserve.run(l.qty, l.v.id, l.qty);
      if (res.changes !== 1) throw new CheckoutError("موجودی تغییر کرد؛ دوباره تلاش کنید.");
    }
    addEvent("order", id, "pending_payment", "سفارش ثبت شد و موجودی تا پایان مهلت پرداخت رزرو شد.", "customer");
    return id;
  });
  return getOrderById(tx())!;
}

function restoreStock(orderId: string) {
  const items = db().prepare("SELECT variant_id, qty FROM order_items WHERE order_id = ?").all(orderId) as { variant_id: string; qty: number }[];
  const upd = db().prepare("UPDATE variants SET stock = stock + ? WHERE id = ?");
  for (const i of items) upd.run(i.qty, i.variant_id);
}

/** Lazy expiry: unpaid orders older than the payment window are cancelled and stock is released. */
export function expireStaleOrders() {
  const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MIN * 60_000).toISOString();
  const stale = db()
    .prepare("SELECT id FROM orders WHERE status = 'pending_payment' AND created_at < ?")
    .all(cutoff) as { id: string }[];
  if (!stale.length) return;
  db().transaction(() => {
    for (const s of stale) {
      restoreStock(s.id);
      db().prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now(), s.id);
      addEvent("order", s.id, "cancelled", "مهلت پرداخت به پایان رسید و رزرو موجودی آزاد شد.", "system");
    }
  })();
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

export function transitionOrder(id: string, to: OrderStatus, actor: string, note: string | null = null) {
  const tx = db().transaction(() => {
    const o = getOrderById(id);
    if (!o) throw new Error("not found");
    if (!orderTransitions[o.status].includes(to)) throw new Error(`invalid transition ${o.status} → ${to}`);
    if (to === "cancelled") restoreStock(id);
    db().prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(to, now(), id);
    addEvent("order", id, to, note, actor);
  });
  tx();
}

/**
 * Sandbox settlement — used only when PAYMENT_MODE=sandbox. Marks the
 * payment as `paid_sandbox` (never `paid`) so test orders stay identifiable.
 */
export function settleSandboxPayment(id: string, outcome: "success" | "failure") {
  const tx = db().transaction(() => {
    const o = getOrderById(id);
    if (!o || o.status !== "pending_payment") throw new Error("order is not awaiting payment");
    if (outcome === "failure") {
      db().prepare("UPDATE orders SET payment_status = 'failed', updated_at = ? WHERE id = ?").run(now(), id);
      addEvent("order", id, "payment_failed", "تراکنش آزمایشی ناموفق بود. می‌توانید دوباره تلاش کنید.", "payment-sandbox");
      return;
    }
    const ref = `SANDBOX-${randomBytes(4).toString("hex").toUpperCase()}`;
    db()
      .prepare("UPDATE orders SET status = 'paid', payment_status = 'paid_sandbox', payment_ref = ?, updated_at = ? WHERE id = ?")
      .run(ref, now(), id);
    addEvent("order", id, "paid", `پرداخت آزمایشی — بدون تراکنش واقعی (مرجع ${ref})`, "payment-sandbox");
  });
  tx();
}

/** Manual reconciliation by finance (e.g. card-to-card or bank receipt), recorded with a reference. */
export function recordManualPayment(id: string, reference: string, actor: string) {
  const tx = db().transaction(() => {
    const o = getOrderById(id);
    if (!o || o.status !== "pending_payment") throw new Error("order is not awaiting payment");
    db()
      .prepare("UPDATE orders SET status = 'paid', payment_status = 'paid', payment_ref = ?, updated_at = ? WHERE id = ?")
      .run(reference, now(), id);
    addEvent("order", id, "paid", `پرداخت توسط واحد مالی تطبیق داده شد (مرجع ${reference})`, actor);
  });
  tx();
}
