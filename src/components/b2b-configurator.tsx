"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { faNum, toLatinDigits, toman } from "@/lib/format";
import { b2bPriceVisible, leadTimeDays, snapQty, tierFor, validateB2BQty } from "@/lib/pricing";
import type { B2BSnapshot } from "@/lib/snapshot";
import type { B2BConfig } from "@/lib/types";
import { useInquiry } from "./stores";
import { Button, Field, Icon, Input, Textarea, cx } from "./ui";

export function B2BConfigurator({ product, signedIn }: { product: B2BSnapshot; signedIn: boolean }) {
  const inq = useInquiry();
  const existing = inq.lines.find((l) => l.productId === product.productId);
  const cfg: B2BConfig = { ...product, customization: product.customization };
  const [qtyText, setQtyText] = useState(String(existing?.qty ?? product.moq));
  const [custom, setCustom] = useState<string[]>(existing?.customization ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  // Once localStorage is read, restore a previously saved line for this product.
  const restored = useRef(false);
  useEffect(() => {
    if (!inq.hydrated || restored.current) return;
    restored.current = true;
    if (existing) {
      setQtyText(String(existing.qty));
      setCustom(existing.customization);
      setNote(existing.note);
    }
  }, [inq.hydrated, existing]);

  const qty = Number(toLatinDigits(qtyText).replace(/[,٬\s]/g, ""));
  const qtyError = validateB2BQty(cfg, qty);
  const showPrice = b2bPriceVisible(cfg, custom) && product.tiers.length > 0;
  const tier = showPrice ? tierFor(product.tiers, qty) : null;
  const lead = leadTimeDays(cfg, custom);
  const inList = inq.hydrated && !!existing;

  const save = () => {
    setTouched(true);
    if (qtyError) return;
    inq.upsert({ productId: product.productId, qty, customization: custom, note: note.trim() });
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-2 text-sm">
        {[
          ["حداقل سفارش", `${faNum(product.moq)} ${product.unitLabel}`],
          ["گام سفارش", product.step > 1 ? `مضرب ${faNum(product.step)}` : "آزاد"],
          ["آماده‌سازی", `${faNum(lead)} روز کاری`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-surface px-3 py-2.5 ring-1 ring-line">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="num mt-0.5 font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {product.priceMode === "tiered" && (
        <section aria-labelledby="tiers">
          <h2 id="tiers" className="mb-2 text-sm font-bold text-ink">قیمت پلکانی تقریبی (هر {product.unitLabel}، بدون مالیات)</h2>
          {signedIn ? (
            <table className="w-full overflow-hidden rounded-md text-sm ring-1 ring-line">
              <tbody className="divide-y divide-line bg-surface">
                {product.tiers.map((t, i) => {
                  const nextMin = product.tiers[i + 1]?.minQty;
                  const active = tier?.minQty === t.minQty;
                  return (
                    <tr key={t.minQty} className={cx(active && "bg-clay-50")}>
                      <td className="px-3 py-2.5 text-ink-soft">
                        {nextMin ? `${faNum(t.minQty)} تا ${faNum(nextMin - 1)}` : `${faNum(t.minQty)} و بیشتر`} {product.unitLabel}
                      </td>
                      <td className="num px-3 py-2.5 text-end font-bold text-ink">{toman(t.unitPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="rounded-md border border-dashed border-line-strong bg-surface px-4 py-3 text-sm text-muted">
              قیمت‌های پلکانی برای کاربران واردشده نمایش داده می‌شود.{" "}
              <Link href={`/login?next=/corporate/${product.slug}`} className="font-semibold text-clay-700 hover:underline">ورود</Link>
            </div>
          )}
        </section>
      )}

      {product.customization.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">سفارشی‌سازی (اختیاری)</legend>
          <div className="space-y-2">
            {product.customization.map((c) => (
              <label key={c.id} className={cx("flex cursor-pointer items-start gap-3 rounded-md border bg-surface px-4 py-3 text-sm", custom.includes(c.id) ? "border-clay-600 ring-1 ring-clay-600" : "border-line-strong")}>
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-clay-600"
                  checked={custom.includes(c.id)}
                  onChange={(e) => {
                    setSaved(false);
                    setCustom((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)));
                  }}
                />
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{c.label}</span>
                  <span className="text-xs text-muted">+{faNum(c.extraLeadDays)} روز کاری به زمان آماده‌سازی</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Field label={`تعداد (${product.unitLabel})`} htmlFor="b2b-qty" error={touched ? qtyError ?? undefined : undefined} hint={`حداقل ${faNum(product.moq)}${product.step > 1 ? `، مضرب ${faNum(product.step)}` : ""}`}>
          <Input
            id="b2b-qty"
            inputMode="numeric"
            value={qtyText}
            invalid={touched && !!qtyError}
            onChange={(e) => {
              setQtyText(e.target.value);
              setSaved(false);
            }}
            onBlur={() => setTouched(true)}
            dir="ltr"
            className="text-end text-base font-bold"
          />
          {touched && qtyError && Number.isFinite(qty) && qty > 0 && (
            <button type="button" className="mt-1 text-xs font-semibold text-clay-700 underline underline-offset-2" onClick={() => setQtyText(String(snapQty(cfg, qty)))}>
              اصلاح به {faNum(snapQty(cfg, qty))} {product.unitLabel}
            </button>
          )}
        </Field>
        <div className="rounded-md bg-surface px-4 py-3 text-sm ring-1 ring-line">
          <p className="text-muted">برآورد هزینه</p>
          {showPrice && tier && !qtyError ? (
            <>
              <p className="num mt-0.5 text-lg font-black text-ink">{toman(tier.unitPrice * qty)}</p>
              <p className="text-xs text-muted">تقریبی، بدون مالیات بر ارزش افزوده؛ قیمت قطعی در پیشنهاد قیمت.</p>
            </>
          ) : (
            <p className="mt-0.5 font-semibold text-clay-700">
              {custom.length > 0 || product.priceMode === "quote" ? "قیمت پس از بررسی سفارشی‌سازی در پیشنهاد قیمت اعلام می‌شود." : signedIn ? "تعداد معتبر وارد کنید." : "پس از ورود نمایش داده می‌شود."}
            </p>
          )}
        </div>
      </div>

      <Field label="توضیح برای کارشناس (اختیاری)" htmlFor="b2b-note" hint="مثلاً رایحهٔ موردنظر، رنگ، یا تقسیم ارسال بین شعب">
        <Textarea id="b2b-note" rows={2} maxLength={300} value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="flex-1" onClick={save}>
          {inList ? "به‌روزرسانی در فهرست استعلام" : "افزودن به فهرست استعلام"}
        </Button>
        <Link href="/corporate/meeting" className="inline-flex h-12 items-center rounded-md border border-line-strong bg-surface px-5 text-sm font-semibold text-ink hover:border-ink-soft">
          رزرو جلسه
        </Link>
      </div>
      <div aria-live="polite">
        {saved && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-success/25 bg-success-soft px-4 py-2.5 text-sm text-success">
            <span className="flex items-center gap-2 font-semibold"><Icon name="check" size={18} /> در فهرست استعلام ذخیره شد ({faNum(qty)} {product.unitLabel}).</span>
            <Link href="/corporate/inquiry" className="font-bold underline underline-offset-4">مشاهدهٔ فهرست</Link>
          </div>
        )}
      </div>
      <p className="text-xs leading-6 text-muted">افزودن به فهرست استعلام تعهد خرید نیست. پس از ثبت استعلام، کارشناس فروش سازمانی با شما تماس می‌گیرد.</p>
    </div>
  );
}
