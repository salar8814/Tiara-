"use server";

import { redirect } from "next/navigation";
import { otpMode } from "@/lib/integrations";
import { claimRfqsForUser } from "@/lib/repo/rfqs";
import { issueOtp, upsertUserOnLogin, verifyOtp } from "@/lib/repo/users";
import { endSession, safeNext, startSession } from "@/lib/session";
import { mobileSchema, otpSchema } from "@/lib/validation";

export interface LoginState {
  step: "mobile" | "code";
  mobile?: string;
  error?: string;
  /** Present only in OTP_MODE=display (no SMS provider). Never in production. */
  devCode?: string;
  expiresAt?: string;
}

export async function requestOtpAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = mobileSchema.safeParse(form.get("mobile"));
  if (!parsed.success) return { step: "mobile", error: parsed.error.issues[0].message };
  const mobile = parsed.data;
  if (otpMode() === "disabled") {
    return { step: "mobile", mobile, error: "سرویس پیامک هنوز متصل نشده است؛ ورود در این محیط امکان‌پذیر نیست." };
  }
  const res = issueOtp(mobile);
  if (!res.ok) return { step: "code", mobile, error: `برای ارسال دوبارهٔ کد ${res.retryInSec.toLocaleString("fa-IR")} ثانیه صبر کنید.` };
  // Real implementation: send res.code via the SMS provider here.
  return { step: "code", mobile, devCode: res.code, expiresAt: res.expiresAt };
}

export async function verifyOtpAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const mobile = prev.mobile;
  if (!mobile) return { step: "mobile", error: "شمارهٔ همراه را دوباره وارد کنید." };
  const parsed = otpSchema.safeParse(form.get("code"));
  if (!parsed.success) return { ...prev, error: parsed.error.issues[0].message };
  const result = verifyOtp(mobile, parsed.data);
  const messages = {
    expired: "کد منقضی شده است. کد جدید دریافت کنید.",
    invalid: "کد واردشده درست نیست.",
    locked: "تعداد تلاش‌ها بیش از حد مجاز بود. کد جدید دریافت کنید.",
    missing: "ابتدا کد ورود را دریافت کنید.",
  } as const;
  if (result !== "ok") return { ...prev, error: messages[result] };
  const user = upsertUserOnLogin(mobile);
  claimRfqsForUser(user.id, mobile);
  await startSession(user.id);
  redirect(safeNext(form.get("next"), "/account"));
}

/** Single entry point for the two-step login form. */
export async function loginAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const intent = form.get("intent");
  if (intent === "change") return { step: "mobile", mobile: prev.mobile };
  if (intent === "verify") return verifyOtpAction(prev, form);
  if (intent === "resend") {
    const fd = new FormData();
    fd.set("mobile", prev.mobile ?? "");
    const res = await requestOtpAction(prev, fd);
    return { ...prev, ...res, devCode: res.devCode ?? prev.devCode };
  }
  return requestOtpAction(prev, form);
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}
