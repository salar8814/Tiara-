"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { placeOrderAction } from "@/app/actions/shop";
import { storeRules } from "@/data/rules";
import { cartTotals } from "@/lib/pricing";
import type { VariantSnapshot } from "@/lib/snapshot";
import type { Address } from "@/lib/types";
import { AddressForm } from "./address-form";
import { lineIssue } from "./cart-view";
import { ProductArt } from "./product-art";
import { useCart } from "./stores";
import { Badge, Button, EmptyState, Icon, KeyValue, LinkButton, Money, Notice, cx } from "./ui";

interface Props {
  catalog: Record<string, VariantSnapshot>;
  addresses: Address[];
  paymentMode: "sandbox" | "disabled";
  payrollEnabled: boolean;
  user: { name: string | null; mobile: string };
}

export function CheckoutForm({ catalog, addresses, paymentMode, payrollEnabled, user }: Props) {
  const cart = useCart();
  const router = useRouter();
  const [delivery, setDelivery] = useState("courier");
  const [addressId, setAddressId] = useState<string | null>(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null);
  const [adding, setAdding] = useState(addresses.length === 0);
  const [payment, setPayment] = useState<"gateway" | "payroll">("gateway");
  const [error, setError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  // One key per checkout attempt: a double click, retry or replay returns the same order.
  // Created lazily in the submit handler (not during render) and reused for retries.
  const idempotencyKey = useRef<string | null>(null);

  if (!cart.hydrated) return <div className="h-96 animate-pulse rounded-lg bg-sunken" aria-busy />;
  if (cart.lines.length === 0) {
    return (
      <EmptyState title="سبد خرید خالی است" icon={<Icon name="bag" />} action={<LinkButton href="/shop">بازگشت به فروشگاه</LinkButton>}>
        برای ثبت سفارش ابتدا محصولی به سبد اضافه کنید.
      </EmptyState>
    );
  }

  const method = storeRules.deliveryMethods.find((d) => d.id === delivery)!;
  const valid = cart.lines.filter((l) => catalog[l.variantId]);
  const totals = cartTotals(valid.map((l) => ({ variant: catalog[l.variantId], qty: l.qty })), true, delivery);
  const clientIssues = cart.lines.some((l) => lineIssue(catalog[l.variantId], l.qty));
  const needsAddress = method.requiresAddress && !addressId;
  const canSubmit = !pending && !clientIssues && !needsAddress && (payment === "gateway" || payrollEnabled);

  const submit = () => {
    setError(null);
    setLineErrors({});
    idempotencyKey.current ??= crypto.randomUUID();
    const key = idempotencyKey.current;
    start(async () => {
      const res = await placeOrderAction({
        lines: cart.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        deliveryMethod: delivery,
        addressId: method.requiresAddress ? addressId : null,
        paymentMethod: payment,
        idempotencyKey: key,
      });
      if (!res.ok) {
        setError(res.error);
        setLineErrors(res.lineErrors ?? {});
        router.refresh();
        return;
      }
      cart.clear();
      router.push(`/checkout/${res.code}`);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-5">
        <Step n={1} title="روش تحویل">
          <div className="grid gap-3 sm:grid-cols-2">
            {storeRules.deliveryMethods.map((d) => (
              <ChoiceCard key={d.id} name="delivery" checked={delivery === d.id} onChange={() => setDelivery(d.id)} title={d.name} description={d.description}
                aside={d.fee === 0 ? <Badge tone="success">رایگان</Badge> : <Money value={d.fee} className="text-sm font-semibold" />} />
            ))}
          </div>
        </Step>

        {method.requiresAddress && (
          <Step n={2} title="نشانی تحویل">
            {addresses.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <ChoiceCard
                    key={a.id}
                    name="address"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                    title={<>{a.label} {a.isDefault && <Badge className="ms-1">پیش‌فرض</Badge>}</>}
                    description={`${a.province}، ${a.city}، ${a.street}، پلاک ${a.plaque}${a.unit ? `، واحد ${a.unit}` : ""} — ${a.recipient}`}
                  />
                ))}
              </div>
            )}
            {adding ? (
              <div className={cx(addresses.length > 0 && "mt-5 border-t border-line pt-5")}>
                <h3 className="mb-4 text-sm font-bold text-ink">نشانی جدید</h3>
                <AddressForm
                  defaults={{ recipient: user.name, mobile: user.mobile }}
                  onCancel={addresses.length ? () => setAdding(false) : undefined}
                  onSaved={(a) => {
                    setAddressId(a.id);
                    setAdding(false);
                    router.refresh();
                  }}
                />
              </div>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline">
                <Icon name="plus" size={16} /> افزودن نشانی جدید
              </button>
            )}
          </Step>
        )}

        <Step n={method.requiresAddress ? 3 : 2} title="روش پرداخت">
          <div className="grid gap-3">
            <ChoiceCard
              name="payment"
              checked={payment === "gateway"}
              onChange={() => setPayment("gateway")}
              title="پرداخت اینترنتی (درگاه بانکی شاپرک)"
              description={
                paymentMode === "sandbox"
                  ? "در این محیط درگاه واقعی متصل نیست و پرداخت با شبیه‌ساز آزمایشی انجام می‌شود؛ هیچ مبلغی کسر نمی‌شود."
                  : "درگاه پرداخت هنوز متصل نشده است. سفارش ثبت می‌شود و در وضعیت «در انتظار پرداخت» می‌ماند."
              }
              aside={paymentMode === "sandbox" ? <Badge tone="warning">آزمایشی</Badge> : <Badge>متصل نیست</Badge>}
            />
            <ChoiceCard
              name="payment"
              checked={payment === "payroll"}
              onChange={() => setPayment("payroll")}
              disabled={!payrollEnabled}
              title="کسر از حقوق"
              description={
                payrollEnabled
                  ? "مبلغ سفارش از حقوق ماه آینده کسر می‌شود."
                  : "این روش پس از اتصال به سامانهٔ حقوق و دستمزد فعال می‌شود (سقف اعتبار و اقساط را واحد مالی تعیین می‌کند)."
              }
              aside={!payrollEnabled && <Badge>به‌زودی</Badge>}
            />
          </div>
        </Step>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 font-bold text-ink">خلاصهٔ سفارش</h2>
          <ul className="mb-3 space-y-3">
            {cart.lines.map((l) => {
              const s = catalog[l.variantId];
              const issue = lineErrors[l.variantId] ?? lineIssue(s, l.qty);
              return (
                <li key={l.variantId} className="flex gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded border border-line">{s && <ProductArt art={s.art} />}</div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-semibold text-ink">{s?.productName ?? "کالای حذف‌شده"}</p>
                    <p className="text-xs text-muted">{s?.label} · {l.qty.toLocaleString("fa-IR")} عدد</p>
                    {issue && <p className="text-xs font-semibold text-danger">{issue}</p>}
                  </div>
                  {s && <Money value={s.employeePrice * l.qty} className="text-sm font-semibold" />}
                </li>
              );
            })}
          </ul>
          <KeyValue
            rows={[
              ["جمع به قیمت مصرف‌کننده", <Money key="a" value={totals.subtotalRetail} />],
              ["تخفیف کارکنان", <Money key="b" value={-totals.employeeDiscount} className="text-success" />],
              ["هزینهٔ ارسال", totals.shipping === 0 ? <span key="c" className="text-success">رایگان</span> : <Money key="c" value={totals.shipping} />],
            ]}
          />
          <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
            <span className="font-bold">قابل پرداخت</span>
            <Money value={totals.total} className="text-xl font-black" />
          </div>
          <div aria-live="assertive">{error && <Notice tone="danger" className="mt-4">{error}</Notice>}</div>
          {clientIssues && !error && <Notice tone="danger" className="mt-4">برخی اقلام سبد نیاز به اصلاح دارند. <a href="/cart" className="font-bold underline">بازگشت به سبد</a></Notice>}
          <Button size="lg" className="mt-4 w-full" disabled={!canSubmit} onClick={submit}>
            {pending ? "در حال ثبت سفارش…" : "ثبت سفارش و ادامه به پرداخت"}
          </Button>
          {needsAddress && <p className="mt-2 text-center text-xs text-muted">برای ادامه، نشانی تحویل را انتخاب یا ثبت کنید.</p>}
          <p className="mt-3 text-xs leading-6 text-muted">
            با ثبت سفارش، موجودی اقلام تا ۳۰ دقیقه برای شما رزرو می‌شود. قیمت‌ها و موجودی هنگام ثبت دوباره بررسی می‌شوند.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-bold text-ink">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-xs text-white">{n.toLocaleString("fa-IR")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChoiceCard({
  name,
  checked,
  onChange,
  title,
  description,
  aside,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        "flex gap-3 rounded-md border p-4 transition-colors",
        disabled ? "cursor-not-allowed border-line bg-canvas opacity-70" : "cursor-pointer",
        !disabled && (checked ? "border-ink bg-surface ring-1 ring-ink" : "border-line-strong hover:border-ink-soft"),
      )}
    >
      <input type="radio" name={name} checked={checked && !disabled} onChange={onChange} disabled={disabled} className="mt-1.5 size-4 accent-indigo-700" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold text-ink">{title}</span>
          {aside}
        </span>
        {description && <span className="mt-1 block text-[0.8125rem] leading-6 text-muted">{description}</span>}
      </span>
    </label>
  );
}
