import "server-only";
import { actorOf, assertCan, type Permission } from "../authz";
import { db, tx } from "../db";
import { audit } from "../repo/audit";
import { moveStock } from "../repo/inventory";
import { setMeetingStatus } from "../repo/meetings";
import { OrderStateError, getOrderById, recordManualPayment, recordRefund, transitionOrder } from "../repo/orders";
import { getProductById, getVariant, updateProduct, updateVariantPricing } from "../repo/products";
import { assignRfq, confirmCorporateOrder, getRfqById, issueQuotation, transitionCorporateOrder, transitionRfq } from "../repo/rfqs";
import { setStaffRole } from "../repo/users";
import type { B2BConfig, CorporateOrderStatus, MeetingStatus, OrderStatus, QuotationLine, RfqStatus, StaffRole, User } from "../types";

// Staff operations. Each function: (1) checks the permission for the actor
// taken from the session, (2) performs the change through a guarded repository
// function, (3) records an audit entry in the same transaction where the change
// is not already self-auditing. Server actions are thin wrappers around these.

export class ValidationError extends Error {}

const guard = (actor: User | null, p: Permission): User => {
  assertCan(actor, p);
  return actor;
};

// ── catalog ──

export function updatePricing(actor: User | null, variantId: string, input: { retailPrice: number; employeePrice: number; maxPerOrder: number }) {
  const a = guard(actor, "catalog.edit");
  const { retailPrice, employeePrice, maxPerOrder } = input;
  if (![retailPrice, employeePrice, maxPerOrder].every((n) => Number.isInteger(n) && n >= 0)) throw new ValidationError("مقادیر باید عدد صحیح و نامنفی باشند.");
  if (retailPrice === 0) throw new ValidationError("قیمت مصرف‌کننده نمی‌تواند صفر باشد.");
  if (employeePrice > retailPrice) throw new ValidationError("قیمت کارکنان نمی‌تواند از قیمت مصرف‌کننده بیشتر باشد.");
  if (maxPerOrder < 1 || maxPerOrder > 100) throw new ValidationError("سقف خرید باید بین ۱ و ۱۰۰ باشد.");
  tx(() => {
    const before = getVariant(variantId);
    if (!before) throw new ValidationError("گزینهٔ محصول یافت نشد.");
    updateVariantPricing(variantId, { retailPrice, employeePrice, maxPerOrder });
    audit(actorOf(a), "variant.pricing", "variant", variantId,
      { retailPrice: before.retailPrice, employeePrice: before.employeePrice, maxPerOrder: before.maxPerOrder },
      { retailPrice, employeePrice, maxPerOrder });
  });
}

/** Stock is changed by delta (never overwritten), so concurrent reservations are never lost. */
export function adjustStock(actor: User | null, variantId: string, delta: number, note: string) {
  const a = guard(actor, "inventory.adjust");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) throw new ValidationError("مقدار تغییر باید عدد صحیح غیرصفر باشد.");
  const reason = note.trim();
  if (reason.length < 3 || reason.length > 200) throw new ValidationError("دلیل تغییر موجودی را بنویسید (مثلاً «رسید انبار ۴۵۱۲» یا «شمارش دوره‌ای»).");
  return tx(() => {
    if (!getVariant(variantId)) throw new ValidationError("گزینهٔ محصول یافت نشد.");
    try {
      const after = moveStock(variantId, delta, "adjust", actorOf(a), null, reason);
      audit(actorOf(a), "inventory.adjust", "variant", variantId, { stock: after - delta }, { stock: after, note: reason });
      return after;
    } catch {
      throw new ValidationError("موجودی نمی‌تواند منفی شود.");
    }
  });
}

export function updateProductSettings(actor: User | null, productId: string, input: { active: boolean; summary: string; b2b: B2BConfig | null }) {
  const a = guard(actor, "catalog.edit");
  if (input.summary.trim().length < 3) throw new ValidationError("خلاصهٔ محصول را وارد کنید.");
  if (input.b2b) {
    const { moq, step, leadTimeDays, tiers } = input.b2b;
    if (![moq, step, leadTimeDays].every((n) => Number.isInteger(n) && n > 0)) throw new ValidationError("حداقل سفارش، گام و زمان آماده‌سازی باید مثبت باشند.");
    if (moq % step !== 0) throw new ValidationError("حداقل سفارش باید مضربی از گام سفارش باشد.");
    if (tiers.some((t) => !Number.isInteger(t.minQty) || !Number.isInteger(t.unitPrice) || t.minQty <= 0 || t.unitPrice <= 0)) throw new ValidationError("ردیف‌های قیمت پلکانی نامعتبرند.");
    if (tiers.length && tiers[0].minQty < moq) throw new ValidationError("اولین پلهٔ قیمت نمی‌تواند کمتر از حداقل سفارش باشد.");
  }
  tx(() => {
    const before = getProductById(productId);
    if (!before) throw new ValidationError("محصول یافت نشد.");
    updateProduct(productId, input);
    audit(actorOf(a), "product.settings", "product", productId,
      { active: before.active, summary: before.summary, b2b: before.b2b },
      { active: input.active, summary: input.summary, b2b: input.b2b });
  });
}

// ── B2C orders ──

const FULFIL: OrderStatus[] = ["processing", "shipped", "delivered"];

export function changeOrderStatus(actor: User | null, orderId: string, to: OrderStatus, note: string | null) {
  const o = getOrderById(orderId);
  if (!o) throw new ValidationError("سفارش یافت نشد.");
  if (to === "cancelled") {
    const a = guard(actor, o.status === "pending_payment" ? "orders.cancel_unpaid" : "orders.cancel_paid");
    tx(() => {
      transitionOrder(orderId, "cancelled", actorOf(a), note);
      audit(actorOf(a), "order.cancel", "order", orderId, { status: o.status, paymentStatus: o.paymentStatus }, { status: "cancelled" });
    });
    return;
  }
  if (!FULFIL.includes(to)) throw new OrderStateError("unsupported transition");
  const a = guard(actor, "orders.fulfil");
  transitionOrder(orderId, to, actorOf(a), note);
}

export function recordPayment(actor: User | null, orderId: string, reference: string) {
  const a = guard(actor, "payments.record");
  recordManualPayment(orderId, reference, actorOf(a));
}

export function recordOrderRefund(actor: User | null, orderId: string, reference: string) {
  const a = guard(actor, "refunds.record");
  recordRefund(orderId, reference, actorOf(a));
}

// ── B2B ──

export function changeRfqStatus(actor: User | null, rfqId: string, to: RfqStatus, note: string | null) {
  const a = guard(actor, "rfq.manage");
  if (to !== "in_review" && to !== "closed") throw new ValidationError("unsupported transition");
  transitionRfq(rfqId, to, actorOf(a), note);
}

export function assignRfqOwner(actor: User | null, rfqId: string, staffMobile: string | null) {
  const a = guard(actor, "rfq.manage");
  if (staffMobile) {
    const ok = db().prepare("SELECT 1 FROM staff_roles WHERE mobile = ? AND role IN ('sales','admin')").get(staffMobile);
    if (!ok) throw new ValidationError("مسئول انتخاب‌شده عضو تیم فروش نیست.");
  }
  assignRfq(rfqId, staffMobile, actorOf(a));
}

export function issueRfqQuotation(
  actor: User | null,
  rfqId: string,
  input: { lines: QuotationLine[]; discount: number; validUntil: string; deliveryDate: string; terms: string | null },
) {
  const a = guard(actor, "quotes.issue");
  const rfq = getRfqById(rfqId);
  if (!rfq) throw new ValidationError("درخواست یافت نشد.");
  const allowed = new Set(rfq.items.map((i) => i.productId));
  if (input.lines.some((l) => !allowed.has(l.productId))) throw new ValidationError("ردیف پیشنهاد با اقلام استعلام مطابقت ندارد.");
  return issueQuotation(rfqId, input, actorOf(a));
}

export function confirmRfqOrder(actor: User | null, rfqId: string, reference: string) {
  const a = guard(actor, "corporate_orders.confirm");
  return confirmCorporateOrder(rfqId, reference, actorOf(a));
}

export function advanceCorporateOrder(actor: User | null, id: string, to: CorporateOrderStatus) {
  const a = guard(actor, "corporate_orders.fulfil");
  tx(() => {
    transitionCorporateOrder(id, to, actorOf(a));
    audit(actorOf(a), "corporate_order.status", "corporate_order", id, null, { status: to });
  });
}

export function changeMeetingStatus(actor: User | null, id: string, to: MeetingStatus) {
  const a = guard(actor, "meetings.manage");
  setMeetingStatus(id, to, actorOf(a));
}

// ── staff ──

const MOBILE = /^09\d{9}$/;

export function changeStaffRole(actor: User | null, mobile: string, role: StaffRole, granted: boolean) {
  const a = guard(actor, "staff.manage");
  if (!MOBILE.test(mobile)) throw new ValidationError("شمارهٔ همراه نامعتبر است.");
  if (!["admin", "sales", "finance", "warehouse"].includes(role)) throw new ValidationError("نقش نامعتبر است.");
  if (!granted && mobile === a.mobile && role === "admin") throw new ValidationError("نمی‌توانید نقش مدیر را از خودتان بگیرید.");
  setStaffRole(mobile, role, granted, actorOf(a));
}
