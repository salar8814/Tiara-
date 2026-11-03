"use client";

import Link from "next/link";
import { storeRules } from "@/data/rules";
import { cartTotals } from "@/lib/pricing";
import type { VariantSnapshot } from "@/lib/snapshot";
import { QtyStepper } from "./cart-buttons";
import { ProductArt } from "./product-art";
import { useCart } from "./stores";
import { EmptyState, Icon, KeyValue, LinkButton, Money, Notice, cx } from "./ui";

export function lineIssue(snap: VariantSnapshot | undefined, qty: number): string | null {
  if (!snap) return "این کالا دیگر در فروشگاه موجود نیست.";
  if (snap.stock === 0) return "ناموجود شد؛ از سبد حذف کنید.";
  if (qty > snap.stock) return `فقط ${snap.stock.toLocaleString("fa-IR")} عدد موجود است.`;
  if (qty > snap.maxPerOrder) return `سقف خرید ${snap.maxPerOrder.toLocaleString("fa-IR")} عدد در هر سفارش است.`;
  return null;
}

export function CartView({ catalog, eligible, canCheckout }: { catalog: Record<string, VariantSnapshot>; eligible: boolean; canCheckout: boolean }) {
  const cart = useCart();

  if (!cart.hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]" aria-busy>
        <div className="h-64 animate-pulse rounded-lg bg-sunken" />
        <div className="h-64 animate-pulse rounded-lg bg-sunken" />
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState title="سبد خرید شما خالی است" icon={<Icon name="bag" />} action={<LinkButton href="/shop">مشاهدهٔ محصولات</LinkButton>}>
        محصولات فروشگاه کارکنان را مرور کنید و به سبد اضافه کنید.
      </EmptyState>
    );
  }

  const valid = cart.lines.filter((l) => catalog[l.variantId]);
  const issues = cart.lines.map((l) => lineIssue(catalog[l.variantId], l.qty)).filter(Boolean).length;
  const totals = cartTotals(valid.map((l) => ({ variant: catalog[l.variantId], qty: l.qty })), eligible, "courier");
  const courier = storeRules.deliveryMethods.find((d) => d.id === "courier")!;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <section aria-labelledby="cart-items" className="rounded-lg border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-items" className="font-bold text-ink">
            اقلام سبد <span className="num text-sm font-medium text-muted">({totals.count.toLocaleString("fa-IR")} کالا)</span>
          </h2>
          <button type="button" onClick={cart.clear} className="text-sm font-semibold text-muted hover:text-danger">
            خالی کردن سبد
          </button>
        </div>
        <ul className="divide-y divide-line">
          {cart.lines.map((l) => {
            const s = catalog[l.variantId];
            const issue = lineIssue(s, l.qty);
            return (
              <li key={l.variantId} className="flex gap-4 px-5 py-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-md border border-line sm:size-24">
                  {s ? <ProductArt art={s.art} /> : <div className="h-full bg-sunken" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {s ? (
                      <Link href={`/shop/${s.slug}`} className="font-bold text-ink hover:underline">{s.productName}</Link>
                    ) : (
                      <span className="font-bold text-muted">کالای حذف‌شده</span>
                    )}
                    {s && <p className="text-sm text-muted">{s.label}</p>}
                    {issue && <p className="mt-1 text-[0.8125rem] font-semibold text-danger">{issue}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      {s && s.stock > 0 && (
                        <QtyStepper size="sm" value={l.qty} max={Math.max(l.qty, Math.min(s.stock, s.maxPerOrder))} onChange={(n) => cart.setQty(l.variantId, Math.min(n, s.stock, s.maxPerOrder))} label={`تعداد ${s.productName}`} />
                      )}
                      <button type="button" onClick={() => cart.remove(l.variantId)} className="text-sm font-semibold text-muted hover:text-danger">
                        حذف
                      </button>
                    </div>
                  </div>
                  {s && (
                    <div className="text-start sm:text-end">
                      <Money value={(eligible ? s.employeePrice : s.retailPrice) * l.qty} className="font-bold text-ink" />
                      {eligible && <p><Money value={s.retailPrice * l.qty} strike className="text-xs" /></p>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-2 font-bold text-ink">خلاصهٔ سبد</h2>
          <KeyValue
            rows={[
              ["جمع به قیمت مصرف‌کننده", <Money key="a" value={totals.subtotalRetail} />],
              [
                "تخفیف کارکنان",
                eligible ? <Money key="b" value={-totals.employeeDiscount} className="text-success" /> : <span key="b" className="text-xs text-muted">پس از احراز کارمندی</span>,
              ],
              ["هزینهٔ ارسال", <span key="c" className="text-xs text-muted">در مرحلهٔ بعد</span>],
            ]}
          />
          <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
            <span className="font-bold">جمع قابل پرداخت</span>
            <Money value={totals.total - totals.shipping} className="text-lg font-black" />
          </div>
          {courier.freeOver > 0 && (
            <p className="mt-2 text-xs text-muted">ارسال برای سفارش‌های بالای <Money value={courier.freeOver} /> رایگان است. تحویل در محل کار همیشه رایگان است.</p>
          )}
          {issues > 0 && <Notice tone="danger" className="mt-4">پیش از ادامه، اقلام مشخص‌شده را اصلاح کنید.</Notice>}
          {!canCheckout && (
            <Notice tone="warning" className="mt-4">ثبت سفارش فقط برای کارکنان واجد شرایط امکان‌پذیر است.</Notice>
          )}
          <LinkButton
            href="/checkout"
            size="lg"
            className={cx("mt-4 w-full", (issues > 0 || !canCheckout) && "pointer-events-none opacity-50")}
            aria-disabled={issues > 0 || !canCheckout}
            tabIndex={issues > 0 || !canCheckout ? -1 : undefined}
          >
            ادامهٔ فرایند خرید
          </LinkButton>
          <Link href="/shop" className="mt-3 block text-center text-sm font-semibold text-indigo-700 hover:underline">ادامهٔ خرید</Link>
        </section>
      </aside>
    </div>
  );
}
