"use client";

import { useActionState } from "react";
import { issueQuotationAction, saveProductAction, saveVariantAction, type AdminFormState } from "@/app/actions/admin";
import { faNum, toLatinDigits, toman } from "@/lib/format";
import type { B2BConfig, RfqItem, Variant } from "@/lib/types";
import { useState } from "react";
import { Button, Field, Input, Notice, Textarea } from "./ui";

const small = "h-9 w-full rounded border border-line-strong bg-surface px-2 text-end text-sm num focus:border-indigo-600 focus:outline-none";

export function VariantRow({ v }: { v: Variant }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(saveVariantAction, {});
  return (
    <form action={action} className="grid grid-cols-2 items-end gap-2 py-3 sm:grid-cols-[1.4fr_1fr_1fr_.7fr_.7fr_auto]">
      <input type="hidden" name="id" value={v.id} />
      <div className="col-span-2 sm:col-span-1">
        <p className="text-sm font-semibold text-ink">{v.label}</p>
        <p className="ltr text-end text-xs text-subtle sm:text-start">{v.sku}</p>
      </div>
      <label className="text-xs text-muted">قیمت مصرف‌کننده<input name="retailPrice" defaultValue={v.retailPrice} inputMode="numeric" className={small} dir="ltr" /></label>
      <label className="text-xs text-muted">قیمت کارکنان<input name="employeePrice" defaultValue={v.employeePrice} inputMode="numeric" className={small} dir="ltr" /></label>
      <label className="text-xs text-muted">موجودی<input name="stock" defaultValue={v.stock} inputMode="numeric" className={small} dir="ltr" /></label>
      <label className="text-xs text-muted">سقف/سفارش<input name="maxPerOrder" defaultValue={v.maxPerOrder} inputMode="numeric" className={small} dir="ltr" /></label>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <Button size="sm" variant="secondary" disabled={pending}>{pending ? "…" : "ذخیره"}</Button>
        <span aria-live="polite" className="text-xs">
          {state.ok && <span className="font-semibold text-success">ذخیره شد</span>}
          {state.error && <span className="font-semibold text-danger">{state.error}</span>}
        </span>
      </div>
    </form>
  );
}

export function ProductSettingsForm({ id, active, summary, b2b }: { id: string; active: boolean; summary: string; b2b: B2BConfig | null }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(saveProductAction, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" name="active" defaultChecked={active} className="size-4 accent-indigo-600" /> نمایش در کاتالوگ (فعال)
      </label>
      <Field label="خلاصهٔ محصول" htmlFor="ps-summary">
        <Input id="ps-summary" name="summary" defaultValue={summary} />
      </Field>
      {b2b && (
        <fieldset className="rounded-md border border-line p-4">
          <legend className="px-1 text-sm font-bold text-ink">قواعد فروش سازمانی</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`حداقل سفارش (${b2b.unitLabel})`} htmlFor="ps-moq"><Input id="ps-moq" name="moq" defaultValue={b2b.moq} dir="ltr" className="text-end" /></Field>
            <Field label="گام سفارش (کارتن)" htmlFor="ps-step"><Input id="ps-step" name="step" defaultValue={b2b.step} dir="ltr" className="text-end" /></Field>
            <Field label="زمان آماده‌سازی (روز کاری)" htmlFor="ps-lead"><Input id="ps-lead" name="leadTimeDays" defaultValue={b2b.leadTimeDays} dir="ltr" className="text-end" /></Field>
          </div>
          {b2b.priceMode === "tiered" ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-ink-soft">قیمت پلکانی تقریبی (تومان، بدون مالیات)</p>
              <div className="space-y-2">
                {b2b.tiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted">از تعداد<input name={`tierQty${i}`} defaultValue={t.minQty} className={small} dir="ltr" /></label>
                    <label className="text-xs text-muted">قیمت واحد<input name={`tierPrice${i}`} defaultValue={t.unitPrice} className={small} dir="ltr" /></label>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">این محصول «فقط با پیشنهاد قیمت» است و قیمتی به خریدار نمایش داده نمی‌شود.</p>
          )}
        </fieldset>
      )}
      <div className="flex items-center gap-3">
        <Button disabled={pending}>{pending ? "در حال ذخیره…" : "ذخیرهٔ تنظیمات"}</Button>
        {state.ok && <span className="text-sm font-semibold text-success">ذخیره شد.</span>}
        {state.error && <span className="text-sm font-semibold text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

export function QuotationBuilder({
  code,
  items,
  suggested,
  vatRate,
  defaultDelivery,
}: {
  code: string;
  items: RfqItem[];
  suggested: (number | null)[];
  vatRate: number;
  defaultDelivery: string;
}) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(issueQuotationAction, {});
  const [qtys, setQtys] = useState(items.map((i) => String(i.qty)));
  const [prices, setPrices] = useState(suggested.map((s) => (s ? String(s) : "")));
  const [discount, setDiscount] = useState("0");
  const n = (s: string) => Number(toLatinDigits(s).replace(/[,٬\s]/g, "")) || 0;
  const subtotal = items.reduce((s, _, i) => s + n(qtys[i]) * n(prices[i]), 0);
  const taxable = Math.max(0, subtotal - n(discount));
  const vat = Math.round(taxable * vatRate);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="code" value={code} />
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={item.productId} className="rounded-md border border-line p-3">
            <p className="text-sm font-semibold text-ink">{item.name}</p>
            {item.customization.length > 0 && <p className="text-xs text-clay-700">سفارشی‌سازی: {item.customization.join("، ")}</p>}
            <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr_1.4fr]">
              <label className="text-xs text-muted">تعداد ({item.unitLabel})<input name={`qty${i}`} value={qtys[i]} onChange={(e) => setQtys((q) => q.map((x, j) => (j === i ? e.target.value : x)))} className={small} dir="ltr" /></label>
              <label className="text-xs text-muted">قیمت واحد (تومان){suggested[i] ? ` · پیشنهاد جدول: ${faNum(suggested[i]!)}` : ""}<input name={`price${i}`} value={prices[i]} onChange={(e) => setPrices((p) => p.map((x, j) => (j === i ? e.target.value : x)))} className={small} dir="ltr" /></label>
              <label className="text-xs text-muted">توضیح ردیف<input name={`note${i}`} defaultValue={item.customization.join("، ")} className="h-9 w-full rounded border border-line-strong bg-surface px-2 text-sm focus:border-indigo-600 focus:outline-none" /></label>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="تخفیف کل (تومان)" htmlFor="q-discount"><Input id="q-discount" name="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} dir="ltr" className="text-end" /></Field>
        <Field label="تاریخ تحویل" htmlFor="q-delivery" hint="میلادی (yyyy-mm-dd)؛ به خریدار به شمسی نمایش داده می‌شود"><Input id="q-delivery" name="deliveryDate" type="date" defaultValue={defaultDelivery} dir="ltr" /></Field>
      </div>
      <Field label="شرایط پرداخت و تحویل" htmlFor="q-terms"><Textarea id="q-terms" name="terms" rows={2} defaultValue="۵۰٪ پیش‌پرداخت، مابقی هنگام تحویل. هزینهٔ ارسال در تهران رایگان." /></Field>
      <dl className="grid grid-cols-2 gap-1 rounded-md bg-canvas p-3 text-sm">
        <dt className="text-muted">جمع</dt><dd className="num text-end">{toman(subtotal)}</dd>
        <dt className="text-muted">مالیات ارزش افزوده</dt><dd className="num text-end">{toman(vat)}</dd>
        <dt className="font-bold">مبلغ نهایی</dt><dd className="num text-end font-black">{toman(taxable + vat)}</dd>
      </dl>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">پیشنهاد قیمت صادر و برای خریدار قابل مشاهده شد.</Notice>}
      <Button disabled={pending}>{pending ? "در حال صدور…" : "صدور پیشنهاد قیمت"}</Button>
    </form>
  );
}
