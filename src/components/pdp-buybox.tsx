"use client";

import Link from "next/link";
import { useState } from "react";
import { discountPercent } from "@/lib/pricing";
import type { Variant } from "@/lib/types";
import { QtyStepper } from "./cart-buttons";
import { useCart } from "./stores";
import { Button, Icon, Money, cx } from "./ui";

export function PdpBuyBox({ variants, eligible }: { variants: Variant[]; eligible: boolean }) {
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstInStock.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const cart = useCart();
  const v = variants.find((x) => x.id === selectedId)!;
  const inCart = cart.lines.find((l) => l.variantId === v.id)?.qty ?? 0;
  const max = Math.max(0, Math.min(v.stock, v.maxPerOrder) - inCart);
  const out = v.stock === 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Money value={v.employeePrice} className="text-[1.75rem] font-black tracking-tight text-ink" />
        <Money value={v.retailPrice} strike className="text-base" />
        <span className="rounded-full bg-success-soft px-2.5 text-sm font-bold leading-7 text-success">
          {discountPercent(v).toLocaleString("fa-IR")}٪ تخفیف کارکنان
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        قیمت مصرف‌کننده <Money value={v.retailPrice} className="font-semibold text-ink-soft" /> · {eligible ? "قیمت کارکنان برای شما اعمال می‌شود" : "قیمت کارکنان پس از احراز کارمندی اعمال می‌شود"}
      </p>

      {variants.length > 1 && (
        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-bold text-ink">انتخاب گزینه</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {variants.map((x) => (
              <label
                key={x.id}
                className={cx(
                  "relative flex cursor-pointer items-center justify-between gap-3 rounded-md border px-4 py-3 transition-colors",
                  x.id === selectedId ? "border-ink bg-surface ring-1 ring-ink" : "border-line-strong bg-surface hover:border-ink-soft",
                  x.stock === 0 && "opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="variant"
                  value={x.id}
                  checked={x.id === selectedId}
                  onChange={() => {
                    setSelectedId(x.id);
                    setQty(1);
                    setAdded(false);
                  }}
                  className="sr-only"
                />
                <span>
                  <span className="block text-sm font-bold text-ink">{x.label}</span>
                  <span className={cx("block text-xs", x.stock === 0 ? "text-danger" : x.stock <= 5 ? "text-warning" : "text-muted")}>
                    {x.stock === 0 ? "ناموجود" : x.stock <= 5 ? `تنها ${x.stock.toLocaleString("fa-IR")} عدد باقی مانده` : "موجود در انبار"}
                  </span>
                </span>
                <Money value={x.employeePrice} className="text-sm font-bold" />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!out && max > 0 && <QtyStepper value={Math.min(qty, max)} max={max} onChange={setQty} label="تعداد" />}
        <Button
          size="lg"
          className="min-w-48 flex-1"
          disabled={out || max === 0}
          onClick={() => {
            cart.add(v.id, Math.min(qty, max), Math.min(v.stock, v.maxPerOrder));
            setAdded(true);
            setQty(1);
          }}
        >
          {out ? "ناموجود" : max === 0 ? "به سقف خرید این کالا رسیدید" : "افزودن به سبد خرید"}
        </Button>
      </div>

      <div aria-live="polite">
        {added && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-success/25 bg-success-soft px-4 py-2.5 text-sm text-success">
            <span className="flex items-center gap-2 font-semibold"><Icon name="check" size={18} /> به سبد خرید اضافه شد.</span>
            <Link href="/cart" className="font-bold underline underline-offset-4">مشاهدهٔ سبد</Link>
          </div>
        )}
      </div>

      <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm text-muted">
        <li className="flex items-center gap-2.5"><Icon name="tag" size={18} className="text-subtle" /> سقف خرید با قیمت کارکنان: {v.maxPerOrder.toLocaleString("fa-IR")} عدد در هر سفارش{inCart > 0 && ` (${inCart.toLocaleString("fa-IR")} عدد در سبد شما)`}</li>
        <li className="flex items-center gap-2.5"><Icon name="truck" size={18} className="text-subtle" /> ارسال به نشانی دلخواه یا تحویل رایگان در محل کار</li>
        <li className="flex items-center gap-2.5"><Icon name="shield" size={18} className="text-subtle" /> کالای اصل، تولید گروه صنعتی ماموت</li>
      </ul>
      <p className="ltr mt-3 text-end text-xs text-subtle">SKU {v.sku}</p>
    </div>
  );
}
