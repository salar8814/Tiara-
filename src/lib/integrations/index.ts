import "server-only";

// Central view of external integrations. Every feature that depends on a
// third-party system reads its mode from here, and the UI labels any
// non-production mode explicitly. Nothing in the app reports success for an
// integration that is not configured.

export type PaymentMode = "disabled" | "sandbox";
export type OtpMode = "disabled" | "display";

const isProd = process.env.NODE_ENV === "production";

export function paymentMode(): PaymentMode {
  const v = process.env.PAYMENT_MODE;
  if (v === "sandbox" || v === "disabled") return v;
  return isProd ? "disabled" : "sandbox";
}

export function otpMode(): OtpMode {
  const v = process.env.OTP_MODE;
  if (v === "display" || v === "disabled") return v;
  return isProd ? "disabled" : "display";
}

export function payrollEnabled(): boolean {
  // No payroll/finance API exists yet. Even if the flag is set, the
  // adapter below refuses until it is implemented.
  return process.env.PAYROLL_INTEGRATION === "true" && payrollAdapterImplemented;
}

const payrollAdapterImplemented = false;

export interface IntegrationStatus {
  id: string;
  name: string;
  state: "connected" | "sandbox" | "not_connected" | "demo_data";
  detail: string;
}

export function integrationStatus(): IntegrationStatus[] {
  return [
    {
      id: "db",
      name: "پایگاه داده",
      state: "connected",
      detail: "SQLite محلی — مناسب نمونهٔ اولیه؛ برای استقرار به PostgreSQL منتقل شود.",
    },
    {
      id: "hr",
      name: "احراز کارمند (سامانهٔ منابع انسانی)",
      state: "demo_data",
      detail: "از فهرست نمونهٔ کارکنان استفاده می‌شود. اتصال به سامانهٔ HR یا SSO گروه لازم است.",
    },
    {
      id: "sms",
      name: "ارسال پیامک کد ورود",
      state: otpMode() === "display" ? "sandbox" : "not_connected",
      detail:
        otpMode() === "display"
          ? "کد ورود به‌جای پیامک روی صفحه نمایش داده می‌شود (فقط محیط آزمایشی)."
          : "سرویس پیامک متصل نیست؛ ورود غیرفعال است.",
    },
    {
      id: "payment",
      name: "درگاه پرداخت (شاپرک)",
      state: paymentMode() === "sandbox" ? "sandbox" : "not_connected",
      detail:
        paymentMode() === "sandbox"
          ? "شبیه‌ساز درگاه؛ هیچ تراکنش واقعی انجام نمی‌شود و سفارش‌ها برچسب «پرداخت آزمایشی» می‌گیرند."
          : "درگاه پرداخت متصل نیست؛ سفارش‌ها در وضعیت «در انتظار پرداخت» می‌مانند.",
    },
    {
      id: "payroll",
      name: "کسر از حقوق",
      state: payrollEnabled() ? "connected" : "not_connected",
      detail: "نیازمند API واحد مالی/حقوق و دستمزد برای سقف اعتبار و ثبت اقساط.",
    },
    {
      id: "calendar",
      name: "تقویم کارشناسان فروش",
      state: "not_connected",
      detail: "درخواست جلسه ثبت می‌شود و کارشناس آن را دستی در پنل مدیریت تأیید می‌کند.",
    },
  ];
}
