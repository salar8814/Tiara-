"use client";

import { useActionState, useState } from "react";
import { bookMeetingAction, type MeetingState } from "@/app/actions/corporate";
import { b2bRules } from "@/data/rules";
import { faTime } from "@/lib/format";
import { Button, Field, Input, Notice, Textarea, cx } from "./ui";

interface Day {
  iso: string;
  weekday: string;
  day: string;
}

export function MeetingForm({
  days,
  taken,
  rfqCode,
  defaults,
}: {
  days: Day[];
  taken: string[];
  rfqCode: string | null;
  defaults: { company?: string | null; contactName?: string | null; phone?: string | null; topic?: string };
}) {
  const [state, action, pending] = useActionState<MeetingState, FormData>(bookMeetingAction, {});
  const takenSet = new Set(taken);
  const firstFree = days.find((d) => b2bRules.meeting.slots.some((s) => !takenSet.has(`${d.iso} ${s}`)));
  const [date, setDate] = useState(firstFree?.iso ?? days[0]?.iso ?? "");
  const [time, setTime] = useState("");
  const [type, setType] = useState("onsite_client");
  const e = state.errors ?? {};
  const val = (k: string, fallback: string | null | undefined) => state.values?.[k] ?? fallback ?? "";

  return (
    <form action={action} noValidate className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="type" value={type} />
      {rfqCode && <input type="hidden" name="rfqCode" value={rfqCode} />}

      <section className="min-w-0 rounded-lg border border-line bg-surface p-5 sm:p-6" aria-labelledby="slot-title">
        <h2 id="slot-title" className="mb-5 font-bold text-ink">انتخاب زمان</h2>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-soft">روز</legend>
          <div className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map((d) => {
              const free = b2bRules.meeting.slots.filter((s) => !takenSet.has(`${d.iso} ${s}`)).length;
              const on = d.iso === date;
              return (
                <label key={d.iso} className={cx("shrink-0", free === 0 ? "cursor-not-allowed" : "cursor-pointer")}>
                  <input type="radio" name="_day" className="peer sr-only" checked={on} disabled={free === 0} onChange={() => { setDate(d.iso); setTime(""); }} />
                  <span
                    className={cx(
                      "flex w-[5.5rem] flex-col items-center rounded-md border px-2 py-2.5 text-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-clay-200",
                      on ? "border-clay-600 bg-clay-600 text-white" : free === 0 ? "border-line bg-canvas text-subtle" : "border-line-strong bg-surface text-ink hover:border-ink-soft",
                    )}
                  >
                    <span className={cx("text-xs", on ? "text-white/80" : "text-muted")}>{d.weekday}</span>
                    <span className="text-sm font-bold">{d.day}</span>
                    <span className={cx("mt-0.5 text-[0.6875rem]", on ? "text-white/80" : "text-subtle")}>{free === 0 ? "تکمیل" : `${free.toLocaleString("fa-IR")} زمان آزاد`}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-semibold text-ink-soft">ساعت <span className="font-normal text-muted">({b2bRules.meeting.durationMinutes.toLocaleString("fa-IR")} دقیقه)</span></legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {b2bRules.meeting.slots.map((s) => {
              const isTaken = takenSet.has(`${date} ${s}`);
              const on = time === s;
              return (
                <label key={s} className={isTaken ? "cursor-not-allowed" : "cursor-pointer"}>
                  <input type="radio" name="_time" className="peer sr-only" checked={on} disabled={isTaken} onChange={() => setTime(s)} aria-label={`${faTime(s)}${isTaken ? " — رزروشده" : ""}`} />
                  <span
                    className={cx(
                      "num flex h-11 items-center justify-center rounded-md border text-sm font-bold peer-focus-visible:ring-2 peer-focus-visible:ring-clay-200",
                      on ? "border-clay-600 bg-clay-600 text-white" : isTaken ? "border-line bg-canvas text-subtle line-through" : "border-line-strong bg-surface text-ink hover:border-ink-soft",
                    )}
                  >
                    {faTime(s)}
                  </span>
                </label>
              );
            })}
          </div>
          {e.time && <p className="mt-2 text-[0.8125rem] font-medium text-danger">{e.time}</p>}
        </fieldset>

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-semibold text-ink-soft">نوع جلسه</legend>
          <div className="flex flex-wrap gap-2">
            {b2bRules.meeting.types.map((t) => (
              <label key={t.id} className="cursor-pointer">
                <input type="radio" name="_type" className="peer sr-only" checked={type === t.id} onChange={() => setType(t.id)} />
                <span className={cx("flex h-10 items-center rounded-full border px-4 text-sm font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-clay-200", type === t.id ? "border-clay-600 bg-clay-50 text-clay-800" : "border-line-strong text-ink-soft")}>
                  {t.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="min-w-0 rounded-lg border border-line bg-surface p-5 sm:p-6" aria-labelledby="contact-title">
        <h2 id="contact-title" className="mb-5 font-bold text-ink">اطلاعات درخواست</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام سازمان" htmlFor="m-company" error={e.company} required>
            <Input id="m-company" name="company" defaultValue={val("company", defaults.company)} invalid={!!e.company} />
          </Field>
          <Field label="نام و نام خانوادگی" htmlFor="m-name" error={e.contactName} required>
            <Input id="m-name" name="contactName" defaultValue={val("contactName", defaults.contactName)} invalid={!!e.contactName} />
          </Field>
          <Field label="شمارهٔ تماس" htmlFor="m-phone" error={e.phone} required className="sm:col-span-2">
            <Input id="m-phone" name="phone" inputMode="tel" dir="ltr" className="text-end" defaultValue={val("phone", defaults.phone)} invalid={!!e.phone} />
          </Field>
          <Field label="موضوع جلسه" htmlFor="m-topic" hint="سفارشی‌سازی، تیراژ، زمان تحویل موردنظر" className="sm:col-span-2">
            <Textarea id="m-topic" name="topic" rows={3} defaultValue={val("topic", defaults.topic)} maxLength={600} />
          </Field>
        </div>
        <Notice tone="info" className="mt-5">
          این یک درخواست جلسه است. تقویم کارشناسان هنوز به سامانه متصل نیست؛ کارشناس فروش زمان را بررسی و تأیید می‌کند و وضعیت در صفحهٔ پیگیری به‌روز می‌شود.
        </Notice>
        <div aria-live="assertive">{state.error && <Notice tone="danger" className="mt-4">{state.error}</Notice>}</div>
        <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending || !time || !date}>
          {pending ? "در حال ثبت…" : time ? "ثبت درخواست جلسه" : "ابتدا ساعت جلسه را انتخاب کنید"}
        </Button>
      </section>
    </form>
  );
}
