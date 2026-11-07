// Status vocabulary and allowed transitions. UI labels and server-side
// guards both read from here so the state machine is defined once.

import type {
  CorporateOrderStatus,
  MeetingStatus,
  OrderStatus,
  QuotationStatus,
  RfqStatus,
} from "./types";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand" | "clay";

export const orderStatus: Record<OrderStatus, { label: string; tone: Tone; hint: string }> = {
  pending_payment: { label: "در انتظار پرداخت", tone: "warning", hint: "سفارش ثبت شده اما هنوز پرداخت نشده است." },
  paid: { label: "پرداخت‌شده", tone: "info", hint: "پرداخت تأیید شد و سفارش در صف آماده‌سازی است." },
  processing: { label: "در حال آماده‌سازی", tone: "info", hint: "اقلام در انبار جمع‌آوری و بسته‌بندی می‌شوند." },
  shipped: { label: "ارسال‌شده", tone: "brand", hint: "سفارش تحویل حمل‌ونقل شده است." },
  delivered: { label: "تحویل‌شده", tone: "success", hint: "سفارش تحویل گرفته شد." },
  cancelled: { label: "لغوشده", tone: "danger", hint: "این سفارش لغو شده است." },
};

export const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const orderFlow: OrderStatus[] = ["pending_payment", "paid", "processing", "shipped", "delivered"];

export const rfqStatus: Record<RfqStatus, { label: string; tone: Tone; hint: string }> = {
  submitted: { label: "استعلام ثبت شد", tone: "neutral", hint: "درخواست شما دریافت شد و به کارشناس فروش سازمانی ارجاع می‌شود." },
  in_review: { label: "در حال بررسی", tone: "info", hint: "کارشناس فروش در حال امکان‌سنجی تیراژ، سفارشی‌سازی و زمان تحویل است." },
  quoted: { label: "پیشنهاد قیمت صادر شد", tone: "clay", hint: "پیشنهاد قیمت آمادهٔ بررسی و تأیید شماست." },
  approved: { label: "پیشنهاد تأیید شد", tone: "brand", hint: "پیش‌فاکتور صادر شد. پس از پرداخت یا دریافت سفارش خرید، سفارش قطعی می‌شود." },
  converted: { label: "سفارش قطعی", tone: "success", hint: "سفارش سازمانی قطعی و وارد برنامهٔ تولید شد." },
  declined: { label: "ردشده توسط مشتری", tone: "danger", hint: "پیشنهاد قیمت توسط شما رد شد." },
  closed: { label: "بسته‌شده", tone: "danger", hint: "این درخواست توسط فروش بسته شد." },
};

export const rfqFlow: RfqStatus[] = ["submitted", "in_review", "quoted", "approved", "converted"];

export const rfqTransitions: Record<RfqStatus, RfqStatus[]> = {
  submitted: ["in_review", "closed"],
  in_review: ["quoted", "closed"],
  quoted: ["approved", "declined", "in_review", "closed"],
  approved: ["converted", "closed"],
  converted: [],
  declined: ["in_review", "closed"],
  closed: [],
};

export const quotationStatus: Record<QuotationStatus, { label: string; tone: Tone }> = {
  issued: { label: "در انتظار تأیید شما", tone: "clay" },
  approved: { label: "تأییدشده", tone: "success" },
  declined: { label: "ردشده", tone: "danger" },
  superseded: { label: "جایگزین‌شده با نسخهٔ جدید", tone: "neutral" },
  expired: { label: "منقضی‌شده", tone: "neutral" },
  withdrawn: { label: "پس‌گرفته‌شده برای بازنگری", tone: "neutral" },
};

export const paymentStatusLabel: Record<import("./types").PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "پرداخت‌نشده", tone: "warning" },
  failed: { label: "تراکنش ناموفق", tone: "danger" },
  paid: { label: "پرداخت‌شده", tone: "success" },
  paid_sandbox: { label: "پرداخت آزمایشی", tone: "warning" },
  refund_pending: { label: "در انتظار بازگشت وجه", tone: "danger" },
  refunded: { label: "وجه بازگردانده شد", tone: "neutral" },
};

export const corporateOrderStatus: Record<CorporateOrderStatus, { label: string; tone: Tone }> = {
  confirmed: { label: "قطعی‌شده", tone: "success" },
  in_production: { label: "در حال تولید", tone: "info" },
  shipped: { label: "ارسال‌شده", tone: "brand" },
  delivered: { label: "تحویل‌شده", tone: "success" },
};

export const corporateOrderTransitions: Record<CorporateOrderStatus, CorporateOrderStatus[]> = {
  confirmed: ["in_production"],
  in_production: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
};

export const meetingStatus: Record<MeetingStatus, { label: string; tone: Tone }> = {
  requested: { label: "درخواست‌شده — منتظر تأیید کارشناس", tone: "warning" },
  confirmed: { label: "تأییدشده", tone: "success" },
  cancelled: { label: "لغوشده", tone: "danger" },
  completed: { label: "برگزارشده", tone: "neutral" },
};

export const eligibilityLabel = {
  eligible: { label: "کارمند — واجد شرایط", tone: "success" as Tone },
  pending: { label: "در انتظار فعال‌سازی", tone: "warning" as Tone },
  ineligible: { label: "غیرفعال", tone: "danger" as Tone },
  not_employee: { label: "مشتری سازمانی", tone: "neutral" as Tone },
};

export const rfqEventLabels: Record<string, string> = {
  ...Object.fromEntries(Object.entries(rfqStatus).map(([k, v]) => [k, v.label])),
  meeting_requested: "درخواست جلسه ثبت شد",
  meeting_confirmed: "جلسه تأیید شد",
  meeting_cancelled: "جلسه لغو شد",
  meeting_completed: "جلسه برگزار شد",
  quotation_withdrawn: "پیشنهاد قیمت پس گرفته شد",
  quotation_expired: "اعتبار پیشنهاد قیمت تمام شد",
};
