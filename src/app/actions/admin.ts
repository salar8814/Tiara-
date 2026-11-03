"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { storeRules } from "@/data/rules";
import { addDays, tehranIsoDate, toLatinDigits } from "@/lib/format";
import { setMeetingStatus } from "@/lib/repo/meetings";
import { recordManualPayment, transitionOrder } from "@/lib/repo/orders";
import { getProductById, updateProduct, updateVariant } from "@/lib/repo/products";
import {
  confirmCorporateOrder,
  getRfqByCode,
  issueQuotation,
  transitionCorporateOrder,
  transitionRfq,
} from "@/lib/repo/rfqs";
import { requireAdmin } from "@/lib/session";
import type { CorporateOrderStatus, MeetingStatus, OrderStatus, QuotationLine, RfqStatus } from "@/lib/types";

const int = (v: FormDataEntryValue | null) => {
  const n = Number(toLatinDigits(String(v ?? "")).replace(/[,٬\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

export interface AdminFormState {
  ok?: boolean;
  error?: string;
}

export async function saveVariantAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const id = String(form.get("id"));
  const retailPrice = int(form.get("retailPrice"));
  const employeePrice = int(form.get("employeePrice"));
  const stock = int(form.get("stock"));
  const maxPerOrder = int(form.get("maxPerOrder"));
  if ([retailPrice, employeePrice, stock, maxPerOrder].some((n) => !Number.isInteger(n) || n < 0)) {
    return { error: "مقادیر باید عدد صحیح و نامنفی باشند." };
  }
  if (employeePrice > retailPrice) return { error: "قیمت کارکنان نمی‌تواند از قیمت مصرف‌کننده بیشتر باشد." };
  if (maxPerOrder < 1) return { error: "سقف خرید باید دست‌کم ۱ باشد." };
  updateVariant(id, { retailPrice, employeePrice, stock, maxPerOrder });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true };
}

export async function saveProductAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const p = getProductById(String(form.get("id")));
  if (!p) return { error: "محصول یافت نشد." };
  const summary = String(form.get("summary") ?? "").trim();
  if (summary.length < 3) return { error: "خلاصهٔ محصول را وارد کنید." };
  let b2b = p.b2b;
  if (b2b) {
    const moq = int(form.get("moq"));
    const step = int(form.get("step"));
    const leadTimeDays = int(form.get("leadTimeDays"));
    if (![moq, step, leadTimeDays].every((n) => Number.isInteger(n) && n > 0)) return { error: "حداقل سفارش، گام و زمان آماده‌سازی باید مثبت باشند." };
    if (moq % step !== 0) return { error: "حداقل سفارش باید مضربی از گام سفارش باشد." };
    const tiers = b2b.tiers.map((t, i) => ({ minQty: int(form.get(`tierQty${i}`)), unitPrice: int(form.get(`tierPrice${i}`)) }));
    if (tiers.some((t) => !Number.isInteger(t.minQty) || !Number.isInteger(t.unitPrice) || t.minQty <= 0 || t.unitPrice <= 0)) {
      return { error: "ردیف‌های قیمت پلکانی نامعتبرند." };
    }
    b2b = { ...b2b, moq, step, leadTimeDays, tiers: tiers.sort((a, b) => a.minQty - b.minQty) };
  }
  updateProduct(p.id, { active: form.get("active") === "on", summary, b2b });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/corporate");
  return { ok: true };
}

export async function orderTransitionAction(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const to = String(form.get("to")) as OrderStatus;
  const note = String(form.get("note") ?? "").trim() || null;
  transitionOrder(id, to, `admin:${admin.mobile}`, note);
  revalidatePath("/admin/orders");
}

export async function manualPaymentAction(form: FormData) {
  const admin = await requireAdmin();
  const ref = toLatinDigits(String(form.get("reference") ?? "")).trim();
  if (ref.length < 4) redirect("/admin/orders?error=reference");
  recordManualPayment(String(form.get("id")), ref, `admin:${admin.mobile}`);
  revalidatePath("/admin/orders");
}

export async function rfqTransitionAction(form: FormData) {
  const admin = await requireAdmin();
  const code = String(form.get("code"));
  const rfq = getRfqByCode(code);
  if (!rfq) redirect("/admin/requests");
  transitionRfq(rfq.id, String(form.get("to")) as RfqStatus, `admin:${admin.mobile}`, String(form.get("note") ?? "").trim() || null);
  revalidatePath(`/admin/requests/${code}`);
}

export async function issueQuotationAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const rfq = getRfqByCode(String(form.get("code")));
  if (!rfq) return { error: "درخواست یافت نشد." };
  const lines: QuotationLine[] = rfq.items.map((item, i) => ({
    productId: item.productId,
    name: item.name,
    qty: int(form.get(`qty${i}`)),
    unitLabel: item.unitLabel,
    unitPrice: int(form.get(`price${i}`)),
    note: String(form.get(`note${i}`) ?? "").trim(),
  }));
  if (lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0 || !Number.isInteger(l.unitPrice) || l.unitPrice <= 0)) {
    return { error: "تعداد و قیمت واحد همهٔ ردیف‌ها باید عدد مثبت باشد." };
  }
  const discount = int(form.get("discount") || "0");
  if (!Number.isInteger(discount) || discount < 0) return { error: "تخفیف نامعتبر است." };
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  if (discount > subtotal) return { error: "تخفیف از جمع کل بیشتر است." };
  const deliveryDate = String(form.get("deliveryDate") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || deliveryDate <= tehranIsoDate()) return { error: "تاریخ تحویل معتبر انتخاب کنید." };
  try {
    issueQuotation(
      rfq.id,
      {
        lines,
        discount,
        validUntil: addDays(tehranIsoDate(), storeRules.quotationValidityDays),
        deliveryDate,
        terms: String(form.get("terms") ?? "").trim() || null,
      },
      `admin:${admin.mobile}`,
    );
  } catch {
    return { error: "در وضعیت فعلی این درخواست امکان صدور پیشنهاد قیمت نیست. ابتدا آن را «در حال بررسی» کنید." };
  }
  revalidatePath(`/admin/requests/${rfq.code}`);
  return { ok: true };
}

export async function confirmCorporateOrderAction(form: FormData) {
  const admin = await requireAdmin();
  const code = String(form.get("code"));
  const ref = toLatinDigits(String(form.get("reference") ?? "")).trim();
  const rfq = getRfqByCode(code);
  if (!rfq || ref.length < 3) redirect(`/admin/requests/${code}?error=reference`);
  confirmCorporateOrder(rfq.id, ref, `admin:${admin.mobile}`);
  revalidatePath(`/admin/requests/${code}`);
}

export async function corporateOrderTransitionAction(form: FormData) {
  const admin = await requireAdmin();
  transitionCorporateOrder(String(form.get("id")), String(form.get("to")) as CorporateOrderStatus, `admin:${admin.mobile}`);
  revalidatePath(`/admin/requests/${String(form.get("code"))}`);
}

export async function meetingStatusAction(form: FormData) {
  const admin = await requireAdmin();
  setMeetingStatus(String(form.get("id")), String(form.get("to")) as MeetingStatus, `admin:${admin.mobile}`);
  revalidatePath("/admin/meetings");
}
