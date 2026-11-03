"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { b2bRules } from "@/data/rules";
import { occasionById } from "@/data/taxonomy";
import { canAccessRfq, grantRfqAccess } from "@/lib/access";
import { addDays, tehranIsoDate, toLatinDigits } from "@/lib/format";
import { validateB2BQty } from "@/lib/pricing";
import { SlotTakenError, requestMeeting } from "@/lib/repo/meetings";
import { listProducts } from "@/lib/repo/products";
import { createRfq, decideQuotation, getRfqByCode, listQuotations } from "@/lib/repo/rfqs";
import { currentUser } from "@/lib/session";
import type { RfqItem } from "@/lib/types";
import { fieldErrors, meetingSchema, rfqContactSchema, rfqItemSchema, type FieldErrors } from "@/lib/validation";

export interface RfqSubmitInput {
  contact: Record<string, string>;
  items: { productId: string; qty: number; customization: string[]; note: string }[];
  withMeeting: boolean;
}

export type RfqSubmitResult =
  | { ok: false; errors: FieldErrors; itemErrors?: Record<string, string>; error?: string }
  | { ok: true; code: string };

export async function submitRfqAction(input: RfqSubmitInput): Promise<RfqSubmitResult> {
  const user = await currentUser();
  const contact = rfqContactSchema.safeParse(input.contact ?? {});
  const errors: FieldErrors = contact.success ? {} : fieldErrors(contact.error);

  if (contact.success) {
    const minDate = addDays(tehranIsoDate(), 3);
    if (contact.data.deadline < minDate) errors.deadline = "زمان تحویل باید دست‌کم سه روز بعد باشد.";
    if (!occasionById(contact.data.occasion)) errors.occasion = "مناسبت را انتخاب کنید.";
    if (!b2bRules.budgetRanges.some((b) => b.id === contact.data.budget)) errors.budget = "بازهٔ بودجه را انتخاب کنید.";
  }

  const rawItems = Array.isArray(input.items) ? input.items.slice(0, 30) : [];
  if (rawItems.length === 0) return { ok: false, errors, error: "فهرست استعلام خالی است. دست‌کم یک محصول اضافه کنید." };

  const catalog = new Map(listProducts({ channel: "b2b" }).map((p) => [p.id, p]));
  const itemErrors: Record<string, string> = {};
  const items: RfqItem[] = [];
  for (const raw of rawItems) {
    const parsed = rfqItemSchema.safeParse(raw);
    const product = parsed.success ? catalog.get(parsed.data.productId) : undefined;
    if (!parsed.success || !product?.b2b) {
      itemErrors[String(raw?.productId)] = "این محصول در کاتالوگ سازمانی موجود نیست.";
      continue;
    }
    const qtyError = validateB2BQty(product.b2b, parsed.data.qty);
    if (qtyError) itemErrors[product.id] = qtyError;
    const validCustom = parsed.data.customization.filter((c) => product.b2b!.customization.some((o) => o.id === c));
    items.push({
      productId: product.id,
      name: product.name,
      qty: parsed.data.qty,
      unitLabel: product.b2b.unitLabel,
      customization: validCustom.map((c) => product.b2b!.customization.find((o) => o.id === c)!.label),
      note: parsed.data.note.trim(),
    });
  }

  if (Object.keys(errors).length || Object.keys(itemErrors).length || !contact.success) {
    return { ok: false, errors, itemErrors, error: "لطفاً موارد مشخص‌شده را اصلاح کنید." };
  }

  const rfq = createRfq({ userId: user?.id ?? null, ...contact.data, items });
  await grantRfqAccess(rfq.code);
  revalidatePath("/account");
  return { ok: true, code: rfq.code };
}

export interface TrackState {
  error?: string;
}

export async function trackRfqAction(_prev: TrackState, form: FormData): Promise<TrackState> {
  const code = toLatinDigits(String(form.get("code") ?? "")).trim().toUpperCase();
  const phone = toLatinDigits(String(form.get("phone") ?? "")).replace(/[\s-]/g, "");
  const rfq = code ? getRfqByCode(code) : null;
  // Same message whether the code or the phone is wrong, to avoid enumeration.
  if (!rfq || rfq.phone !== phone) return { error: "درخواستی با این کد و شمارهٔ تماس پیدا نشد." };
  await grantRfqAccess(rfq.code);
  redirect(`/corporate/requests/${rfq.code}`);
}

export interface MeetingState {
  errors?: FieldErrors;
  error?: string;
}

export async function bookMeetingAction(_prev: MeetingState, form: FormData): Promise<MeetingState> {
  const user = await currentUser();
  const parsed = meetingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), error: "لطفاً موارد مشخص‌شده را کامل کنید." };
  const d = parsed.data;

  let rfqId: string | null = null;
  if (d.rfqCode) {
    const rfq = getRfqByCode(d.rfqCode);
    if (!rfq || !(await canAccessRfq(rfq, user))) return { error: "درخواست مرتبط یافت نشد." };
    rfqId = rfq.id;
  }
  try {
    requestMeeting({
      rfqId,
      userId: user?.id ?? null,
      date: d.date,
      time: d.time,
      type: d.type,
      company: d.company,
      contactName: d.contactName,
      phone: d.phone,
      topic: d.topic ?? null,
    });
  } catch (e) {
    if (e instanceof SlotTakenError) return { errors: { time: e.message }, error: e.message };
    throw e;
  }
  revalidatePath("/corporate/meeting");
  if (d.rfqCode) redirect(`/corporate/requests/${d.rfqCode}?meeting=requested`);
  redirect(`/corporate/meeting/requested?date=${d.date}&time=${encodeURIComponent(d.time)}&type=${d.type}`);
}

export async function decideQuotationAction(form: FormData) {
  const user = await currentUser();
  const code = String(form.get("code") ?? "");
  const quotationId = String(form.get("quotationId") ?? "");
  const decision = form.get("decision") === "approved" ? "approved" : "declined";
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const rfq = getRfqByCode(code);
  if (!rfq || !(await canAccessRfq(rfq, user))) redirect("/corporate/track");
  if (!listQuotations(rfq.id).some((q) => q.id === quotationId && q.status === "issued")) {
    redirect(`/corporate/requests/${code}?error=quotation`);
  }
  decideQuotation(quotationId, decision, user ? `customer:${user.mobile}` : `customer:${rfq.phone}`, note);
  revalidatePath(`/corporate/requests/${code}`);
  redirect(`/corporate/requests/${code}?decision=${decision}`);
}
