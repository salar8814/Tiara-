"use client";

import { useActionState, useEffect, useRef } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button, Field, Input, Notice } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "mobile" });
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.step === "code") codeRef.current?.focus();
  }, [state]);

  if (state.step === "mobile") {
    return (
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="intent" value="request" />
        <Field label="شمارهٔ همراه" htmlFor="mobile" error={state.error} hint="شماره‌ای که در منابع انسانی گروه ثبت کرده‌اید">
          <Input
            id="mobile"
            name="mobile"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className="text-end text-lg tracking-wider"
            placeholder="09xx xxx xxxx"
            defaultValue={state.mobile ?? ""}
            invalid={!!state.error}
            aria-describedby={state.error ? "mobile-error" : "mobile-hint"}
            autoFocus
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "در حال ارسال کد…" : "دریافت کد ورود"}
        </Button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <p className="text-sm text-muted">
        کد ۵ رقمی ارسال‌شده به <span className="ltr font-bold text-ink">{state.mobile}</span> را وارد کنید.
      </p>
      {state.devCode && (
        <Notice tone="prototype">
          سرویس پیامک متصل نیست. کد آزمایشی: <strong className="ltr text-base tracking-[0.3em] text-ink">{state.devCode}</strong>
        </Notice>
      )}
      <Field label="کد ورود" htmlFor="code" error={state.error}>
        <Input
          ref={codeRef}
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={5}
          className="text-center text-xl tracking-[0.5em]"
          invalid={!!state.error}
          aria-describedby={state.error ? "code-error" : undefined}
        />
      </Field>
      <Button type="submit" name="intent" value="verify" size="lg" className="w-full" disabled={pending}>
        {pending ? "در حال بررسی…" : "ورود و بررسی شرایط"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="submit" name="intent" value="resend" formNoValidate className="font-semibold text-indigo-700 hover:underline" disabled={pending}>
          ارسال دوبارهٔ کد
        </button>
        <button type="submit" name="intent" value="change" formNoValidate className="font-semibold text-muted hover:text-ink" disabled={pending}>
          تغییر شماره
        </button>
      </div>
    </form>
  );
}
