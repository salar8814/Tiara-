"use client";

import { useActionState } from "react";
import { trackRfqAction, type TrackState } from "@/app/actions/corporate";
import { Button, Field, Input, Notice } from "./ui";

export function TrackForm({ defaultCode }: { defaultCode: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackRfqAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="کد پیگیری" htmlFor="t-code">
        <Input id="t-code" name="code" dir="ltr" className="text-end uppercase" placeholder="RFQ-1405-12345" defaultValue={state.values?.code ?? defaultCode} required />
      </Field>
      <Field label="شمارهٔ تماس" htmlFor="t-phone">
        <Input id="t-phone" name="phone" dir="ltr" inputMode="tel" className="text-end" placeholder="09xxxxxxxxx" defaultValue={state.values?.phone ?? ""} required />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "در حال جست‌وجو…" : "پیگیری"}</Button>
      <div aria-live="polite" className="sm:col-span-3">{state.error && <Notice tone="danger">{state.error}</Notice>}</div>
    </form>
  );
}
