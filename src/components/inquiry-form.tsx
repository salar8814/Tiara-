"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitRfqAction } from "@/app/actions/corporate";
import { b2bRules } from "@/data/rules";
import { occasions } from "@/data/taxonomy";
import { addDays, daysBetween, faNum, toLatinDigits, toman } from "@/lib/format";
import { b2bPriceVisible, leadTimeDays, tierFor, validateB2BQty } from "@/lib/pricing";
import type { B2BSnapshot } from "@/lib/snapshot";
import type { FieldErrors } from "@/lib/validation";
import { JalaliDateInput } from "./jalali-date-input";
import { ProductArt } from "./product-art";
import { useInquiry } from "./stores";
import { Button, EmptyState, Field, Icon, Input, LinkButton, Notice, Select, Textarea, cx } from "./ui";

interface Props {
  catalog: Record<string, B2BSnapshot>;
  today: string;
  defaults: { company?: string | null; contactName?: string | null; phone?: string; department?: string | null };
}

export function InquiryForm({ catalog, today, defaults }: Props) {
  const inq = useInquiry();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [withMeeting, setWithMeeting] = useState(false);

  if (!inq.hydrated) return <div className="h-96 animate-pulse rounded-lg bg-sunken" aria-busy />;

  if (inq.lines.length === 0) {
    return (
      <EmptyState
        title="فهرست استعلام خالی است"
        icon={<Icon name="list" />}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <LinkButton href="/corporate">مشاهدهٔ کاتالوگ سازمانی</LinkButton>
            <LinkButton href="/corporate/meeting" variant="secondary">رزرو جلسه بدون انتخاب محصول</LinkButton>
          </div>
        }
      >
        محصولات و بسته‌های موردنظر را با تعداد تقریبی از کاتالوگ سازمانی اضافه کنید.
      </EmptyState>
    );
  }

  const lines = inq.lines.filter((l) => catalog[l.productId]);
  const maxLead = Math.max(...lines.map((l) => leadTimeDays({ ...catalog[l.productId] }, l.customization)), 0);
  const minDeadline = addDays(today, 3);
  const tight = deadline && daysBetween(today, deadline) < maxLead + 2;

  const submit = (form: FormData) => {
    setFormError(null);
    const contact = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    contact.deadline = deadline;
    start(async () => {
      const res = await submitRfqAction({ contact, items: lines, withMeeting });
      if (!res.ok) {
        setErrors(res.errors);
        setItemErrors(res.itemErrors ?? {});
        setFormError(res.error ?? null);
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
        return;
      }
      inq.clear();
      router.push(withMeeting ? `/corporate/meeting?rfq=${res.code}` : `/corporate/requests/${res.code}?new=1`);
    });
  };

  return (
    <form action={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      <div className="space-y-6">
        <section className="rounded-lg border border-line bg-surface" aria-labelledby="inq-items">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id="inq-items" className="font-bold text-ink">اقلام استعلام <span className="num text-sm font-medium text-muted">({faNum(lines.length)} قلم)</span></h2>
            <Link href="/corporate" className="flex items-center gap-1 text-sm font-semibold text-clay-700 hover:underline"><Icon name="plus" size={16} /> افزودن محصول</Link>
          </div>
          <ul className="divide-y divide-line">
            {inq.lines.map((l) => {
              const p = catalog[l.productId];
              if (!p) {
                return (
                  <li key={l.productId} className="flex items-center justify-between px-5 py-4 text-sm">
                    <span className="text-danger">این محصول دیگر در کاتالوگ سازمانی نیست.</span>
                    <button type="button" onClick={() => inq.remove(l.productId)} className="font-semibold text-muted hover:text-danger">حذف</button>
                  </li>
                );
              }
              const qtyErr = itemErrors[l.productId] ?? validateB2BQty(p, l.qty);
              const visible = b2bPriceVisible(p, l.customization) && p.tiers.length > 0;
              const tier = visible ? tierFor(p.tiers, l.qty) : null;
              return (
                <li key={l.productId} className="grid gap-4 px-5 py-5 sm:grid-cols-[88px_1fr]">
                  <div className="size-20 overflow-hidden rounded-md border border-line sm:size-[88px]"><ProductArt art={p.art} /></div>
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={`/corporate/${p.slug}`} className="font-bold text-ink hover:underline">{p.name}</Link>
                        <p className="text-xs text-muted">حداقل {faNum(p.moq)} {p.unitLabel}{p.step > 1 && ` · مضرب ${faNum(p.step)}`} · آماده‌سازی {faNum(leadTimeDays(p, l.customization))} روز کاری</p>
                      </div>
                      <button type="button" onClick={() => inq.remove(l.productId)} className="text-sm font-semibold text-muted hover:text-danger">حذف</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                      <Field label={`تعداد (${p.unitLabel})`} htmlFor={`qty-${p.productId}`} error={qtyErr ?? undefined}>
                        <Input
                          id={`qty-${p.productId}`}
                          inputMode="numeric"
                          dir="ltr"
                          className="text-end font-bold"
                          defaultValue={String(l.qty)}
                          invalid={!!qtyErr}
                          onChange={(e) => {
                            const n = Number(toLatinDigits(e.target.value).replace(/[,٬\s]/g, ""));
                            inq.update(l.productId, { qty: Number.isFinite(n) ? n : 0 });
                            setItemErrors((prev) => ({ ...prev, [l.productId]: "" }));
                          }}
                        />
                      </Field>
                      <div className="self-end rounded-md bg-canvas px-3 py-2.5 text-sm">
                        {tier && !qtyErr ? (
                          <span>برآورد تقریبی: <strong className="num text-ink">{toman(tier.unitPrice * l.qty)}</strong> <span className="text-xs text-muted">(بدون مالیات)</span></span>
                        ) : (
                          <span className="text-clay-700">قیمت در پیشنهاد قیمت اعلام می‌شود</span>
                        )}
                      </div>
                    </div>
                    {p.customization.length > 0 && (
                      <fieldset>
                        <legend className="mb-1.5 text-xs font-bold text-ink-soft">سفارشی‌سازی</legend>
                        <div className="flex flex-wrap gap-1.5">
                          {p.customization.map((c) => {
                            const on = l.customization.includes(c.id);
                            return (
                              <label key={c.id} className={cx("cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold", on ? "border-clay-600 bg-clay-50 text-clay-800" : "border-line-strong text-ink-soft")}>
                                <input type="checkbox" className="sr-only" checked={on} onChange={() => inq.update(l.productId, { customization: on ? l.customization.filter((x) => x !== c.id) : [...l.customization, c.id] })} />
                                {on && <Icon name="check" size={12} className="me-1 inline" />}{c.label}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    )}
                    <Input aria-label={`توضیح برای ${p.name}`} placeholder="توضیح این قلم (اختیاری)" defaultValue={l.note} maxLength={300} onChange={(e) => inq.update(l.productId, { note: e.target.value })} className="h-10 text-sm" />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-line bg-surface p-5 sm:p-6" aria-labelledby="inq-details">
          <h2 id="inq-details" className="mb-5 font-bold text-ink">جزئیات مناسبت و تحویل</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="مناسبت" htmlFor="occasion" error={errors.occasion} required>
              <Select id="occasion" name="occasion" defaultValue="" invalid={!!errors.occasion}>
                <option value="" disabled>انتخاب کنید</option>
                {occasions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Field>
            <Field label="بازهٔ بودجه برای هر بسته" htmlFor="budget" error={errors.budget} required>
              <Select id="budget" name="budget" defaultValue="" invalid={!!errors.budget}>
                <option value="" disabled>انتخاب کنید</option>
                {b2bRules.budgetRanges.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field
              label={<span id="deadline-label">مهلت تحویل</span>}
              htmlFor="deadline"
              error={errors.deadline}
              hint={tight ? undefined : `زمان آماده‌سازی استاندارد این فهرست حدود ${faNum(maxLead)} روز کاری است.`}
              required
              className="sm:col-span-2"
            >
              <JalaliDateInput id="deadline" value={deadline} onChange={setDeadline} min={minDeadline} invalid={!!errors.deadline} describedBy={errors.deadline ? "deadline-error" : "deadline-hint"} />
            </Field>
            {tight && (
              <Notice tone="warning" className="sm:col-span-2">
                مهلت انتخاب‌شده از زمان آماده‌سازی استاندارد ({faNum(maxLead)} روز کاری) کوتاه‌تر است. می‌توانید ثبت کنید؛ کارشناس امکان تحویل فوری را بررسی می‌کند.
              </Notice>
            )}
            <Field label="الزامات سفارشی‌سازی" htmlFor="customization" hint="لوگو، رنگ سازمانی، متن کارت، بسته‌بندی ویژه" className="sm:col-span-2">
              <Textarea id="customization" name="customization" rows={3} maxLength={1000} />
            </Field>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="rounded-lg border border-line bg-surface p-5 sm:p-6" aria-labelledby="inq-contact">
          <h2 id="inq-contact" className="mb-5 font-bold text-ink">اطلاعات درخواست‌کننده</h2>
          <div className="space-y-4">
            <Field label="نام سازمان" htmlFor="company" error={errors.company} required>
              <Input id="company" name="company" autoComplete="organization" defaultValue={defaults.company ?? ""} invalid={!!errors.company} />
            </Field>
            <Field label="واحد درخواست‌کننده" htmlFor="department" error={errors.department}>
              <Input id="department" name="department" placeholder="مثلاً منابع انسانی" defaultValue={defaults.department ?? ""} />
            </Field>
            <Field label="نام و نام خانوادگی" htmlFor="contactName" error={errors.contactName} required>
              <Input id="contactName" name="contactName" autoComplete="name" defaultValue={defaults.contactName ?? ""} invalid={!!errors.contactName} />
            </Field>
            <Field label="شمارهٔ تماس" htmlFor="phone" error={errors.phone} hint="برای پیگیری درخواست، همین شماره لازم است" required>
              <Input id="phone" name="phone" inputMode="tel" autoComplete="tel" dir="ltr" className="text-end" defaultValue={defaults.phone ?? ""} invalid={!!errors.phone} />
            </Field>
            <Field label="ایمیل" htmlFor="email" error={errors.email}>
              <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" className="text-end" invalid={!!errors.email} />
            </Field>
            <Field label="توضیحات دیگر" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={2} maxLength={1000} />
            </Field>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md bg-canvas p-3 text-sm text-ink-soft">
              <input type="checkbox" checked={withMeeting} onChange={(e) => setWithMeeting(e.target.checked)} className="mt-1 size-4 accent-clay-600" />
              <span>پس از ثبت، برای این استعلام <strong className="text-ink">جلسه با کارشناس فروش</strong> رزرو می‌کنم.</span>
            </label>
          </div>
          <div aria-live="assertive">{formError && <Notice tone="danger" className="mt-4">{formError}</Notice>}</div>
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending}>
            {pending ? "در حال ثبت…" : withMeeting ? "ثبت استعلام و انتخاب زمان جلسه" : "ثبت درخواست استعلام"}
          </Button>
          <p className="mt-3 text-xs leading-6 text-muted">ثبت استعلام تعهد خرید نیست. کارشناس فروش سازمانی تا پایان روز کاری بعد تماس می‌گیرد.</p>
        </section>
      </aside>
    </form>
  );
}
