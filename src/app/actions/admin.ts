"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { storeRules } from "@/data/rules";
import { ForbiddenError } from "@/lib/authz";
import { addDays, tehranIsoDate, toLatinDigits } from "@/lib/format";
import { OrderStateError } from "@/lib/repo/orders";
import { getProductById } from "@/lib/repo/products";
import { RfqStateError, getRfqByCode } from "@/lib/repo/rfqs";
import {
  ValidationError,
  adjustStock,
  advanceCorporateOrder,
  assignRfqOwner,
  changeMeetingStatus,
  changeOrderStatus,
  changeRfqStatus,
  changeStaffRole,
  confirmRfqOrder,
  issueRfqQuotation,
  recordOrderRefund,
  recordPayment,
  updatePricing,
  updateProductSettings,
} from "@/lib/services/admin";
import { currentUser } from "@/lib/session";
import type { CorporateOrderStatus, MeetingStatus, OrderStatus, QuotationLine, RfqStatus, StaffRole } from "@/lib/types";

// Thin wrappers: identity comes from the session cookie (currentUser), every
// permission check and validation happens in src/lib/services/admin.ts.
// Next.js additionally rejects cross-origin server-action POSTs (Origin check).

const int = (v: FormDataEntryValue | null) => {
  const n = Number(toLatinDigits(String(v ?? "")).replace(/[,٬\s]/g, ""));
  return Number.isFinite(n) && Number.isInteger(n) ? n : NaN;
};
const str = (v: FormDataEntryValue | null, max = 500) => String(v ?? "").trim().slice(0, max);

/** Maps domain errors to a user-facing message; anything else is a real bug and is rethrown. */
function message(e: unknown): string {
  if (e instanceof ForbiddenError) return "شما مجوز انجام این کار را ندارید.";
  if (e instanceof ValidationError) return e.message;
  if (e instanceof OrderStateError || e instanceof RfqStateError) return "وضعیت این مورد تغییر کرده یا این کار در وضعیت فعلی مجاز نیست. صفحه را تازه کنید.";
  if (e instanceof Error && /cannot remove the last admin/.test(e.message)) return "حذف آخرین مدیر سامانه مجاز نیست.";
  if (e instanceof Error && /invalid transition|changed concurrently/.test(e.message)) return "وضعیت این مورد تغییر کرده است. صفحه را تازه کنید.";
  throw e;
}

/** For button forms: run, then redirect back with ?ok or ?error. */
async function act(back: string, fn: () => void, revalidate: string[] = []) {
  let err: string | null = null;
  try {
    fn();
  } catch (e) {
    err = message(e);
  }
  for (const p of [back, ...revalidate]) revalidatePath(p.split("?")[0]);
  const sep = back.includes("?") ? "&" : "?";
  redirect(err ? `${back}${sep}error=${encodeURIComponent(err)}` : `${back}${sep}ok=1`);
}

export interface AdminFormState {
  ok?: boolean;
  error?: string;
}

async function state(fn: () => void, revalidate: string[]): Promise<AdminFormState> {
  try {
    fn();
  } catch (e) {
    return { error: message(e) };
  }
  for (const p of revalidate) revalidatePath(p);
  return { ok: true };
}

// ── catalog & inventory ──

export async function savePricingAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const actor = await currentUser();
  return state(
    () => updatePricing(actor, str(form.get("id"), 80), { retailPrice: int(form.get("retailPrice")), employeePrice: int(form.get("employeePrice")), maxPerOrder: int(form.get("maxPerOrder")) }),
    ["/admin/products", "/shop"],
  );
}

export async function adjustStockAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const actor = await currentUser();
  return state(() => void adjustStock(actor, str(form.get("id"), 80), int(form.get("delta")), str(form.get("note"), 200)), ["/admin/products", "/shop"]);
}

export async function saveProductAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const actor = await currentUser();
  const p = getProductById(str(form.get("id"), 80));
  if (!p) return { error: "محصول یافت نشد." };
  const b2b = p.b2b
    ? {
        ...p.b2b,
        moq: int(form.get("moq")),
        step: int(form.get("step")),
        leadTimeDays: int(form.get("leadTimeDays")),
        tiers: p.b2b.tiers.map((_, i) => ({ minQty: int(form.get(`tierQty${i}`)), unitPrice: int(form.get(`tierPrice${i}`)) })).sort((a, b) => a.minQty - b.minQty),
      }
    : null;
  return state(() => updateProductSettings(actor, p.id, { active: form.get("active") === "on", summary: str(form.get("summary"), 300), b2b }), [
    "/admin/products",
    "/shop",
    "/corporate",
  ]);
}

// ── B2C orders ──

export async function orderStatusAction(form: FormData) {
  const actor = await currentUser();
  await act("/admin/orders", () => changeOrderStatus(actor, str(form.get("id"), 80), str(form.get("to"), 40) as OrderStatus, str(form.get("note")) || null), ["/shop"]);
}

export async function manualPaymentAction(form: FormData) {
  const actor = await currentUser();
  await act("/admin/orders", () => recordPayment(actor, str(form.get("id"), 80), toLatinDigits(str(form.get("reference"), 64))));
}

export async function refundAction(form: FormData) {
  const actor = await currentUser();
  await act("/admin/orders", () => recordOrderRefund(actor, str(form.get("id"), 80), toLatinDigits(str(form.get("reference"), 64))));
}

// ── B2B ──

export async function rfqTransitionAction(form: FormData) {
  const actor = await currentUser();
  const rfq = getRfqByCode(str(form.get("code"), 40));
  if (!rfq) redirect("/admin/requests");
  await act(`/admin/requests/${rfq.code}`, () => changeRfqStatus(actor, rfq.id, str(form.get("to"), 40) as RfqStatus, str(form.get("note")) || null));
}

export async function assignRfqAction(form: FormData) {
  const actor = await currentUser();
  const rfq = getRfqByCode(str(form.get("code"), 40));
  if (!rfq) redirect("/admin/requests");
  const to = str(form.get("assignee"), 20);
  await act(`/admin/requests/${rfq.code}`, () => assignRfqOwner(actor, rfq.id, to === "" ? null : to === "me" ? actor?.mobile ?? null : to));
}

export async function issueQuotationAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const actor = await currentUser();
  const rfq = getRfqByCode(str(form.get("code"), 40));
  if (!rfq) return { error: "درخواست یافت نشد." };
  const lines: QuotationLine[] = rfq.items.map((item, i) => ({
    productId: item.productId,
    name: item.name,
    qty: int(form.get(`qty${i}`)),
    unitLabel: item.unitLabel,
    unitPrice: int(form.get(`price${i}`)),
    note: str(form.get(`note${i}`), 200),
  }));
  if (lines.some((l) => !(l.qty > 0) || !(l.unitPrice > 0))) return { error: "تعداد و قیمت واحد همهٔ ردیف‌ها باید عدد صحیح مثبت باشد." };
  const discount = int(form.get("discount") || "0");
  if (!(discount >= 0)) return { error: "تخفیف نامعتبر است." };
  if (discount > lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)) return { error: "تخفیف از جمع کل بیشتر است." };
  const deliveryDate = str(form.get("deliveryDate"), 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || deliveryDate <= tehranIsoDate()) return { error: "تاریخ تحویل معتبر انتخاب کنید." };
  return state(
    () =>
      void issueRfqQuotation(actor, rfq.id, {
        lines,
        discount,
        validUntil: addDays(tehranIsoDate(), storeRules.quotationValidityDays),
        deliveryDate,
        terms: str(form.get("terms"), 1000) || null,
      }),
    [`/admin/requests/${rfq.code}`, `/corporate/requests/${rfq.code}`],
  );
}

export async function confirmCorporateOrderAction(form: FormData) {
  const actor = await currentUser();
  const rfq = getRfqByCode(str(form.get("code"), 40));
  if (!rfq) redirect("/admin/requests");
  await act(`/admin/requests/${rfq.code}`, () => void confirmRfqOrder(actor, rfq.id, toLatinDigits(str(form.get("reference"), 64))));
}

export async function corporateOrderTransitionAction(form: FormData) {
  const actor = await currentUser();
  const code = str(form.get("code"), 40);
  await act(`/admin/requests/${code}`, () => advanceCorporateOrder(actor, str(form.get("id"), 80), str(form.get("to"), 40) as CorporateOrderStatus));
}

export async function meetingStatusAction(form: FormData) {
  const actor = await currentUser();
  await act("/admin/meetings", () => changeMeetingStatus(actor, str(form.get("id"), 80), str(form.get("to"), 40) as MeetingStatus));
}

// ── staff ──

export async function staffRoleAction(form: FormData) {
  const actor = await currentUser();
  const mobile = toLatinDigits(str(form.get("mobile"), 20)).replace(/\s/g, "");
  await act("/admin/staff", () => changeStaffRole(actor, mobile, str(form.get("role"), 20) as StaffRole, form.get("grant") === "1"));
}
