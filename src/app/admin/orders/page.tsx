import { manualPaymentAction, orderTransitionAction } from "@/app/actions/admin";
import { Badge, Button, FilterChip, Notice } from "@/components/ui";
import { storeRules } from "@/data/rules";
import { faNum, jDateTime, toman } from "@/lib/format";
import { listOrders } from "@/lib/repo/orders";
import { getUser } from "@/lib/repo/users";
import { orderStatus, orderTransitions } from "@/lib/status";
import type { OrderStatus } from "@/lib/types";

export const metadata = { title: "سفارش‌ها" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const sp = await searchParams;
  const status = sp.status && sp.status in orderStatus ? (sp.status as OrderStatus) : null;
  const all = listOrders();
  const orders = status ? all.filter((o) => o.status === status) : all;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">سفارش‌های فروشگاه کارکنان</h1>
      {sp.error === "reference" && <Notice tone="danger">شمارهٔ مرجع پرداخت باید دست‌کم ۴ کاراکتر باشد.</Notice>}
      <nav className="flex flex-wrap gap-1.5" aria-label="فیلتر وضعیت">
        <FilterChip href="/admin/orders" active={!status} label={`همه (${faNum(all.length)})`} />
        {(Object.keys(orderStatus) as OrderStatus[]).map((s) => (
          <FilterChip key={s} href={`/admin/orders?status=${s}`} active={status === s} label={`${orderStatus[s].label} (${faNum(all.filter((o) => o.status === s).length)})`} />
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">سفارشی با این وضعیت نیست.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const u = getUser(o.userId);
            const next = orderTransitions[o.status].filter((s) => s !== "paid");
            return (
              <li key={o.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="ltr font-bold text-ink">{o.code}</p>
                    <p className="text-xs text-muted">{u?.name ?? u?.mobile} · {jDateTime(o.createdAt)} · {storeRules.deliveryMethods.find((d) => d.id === o.deliveryMethod)?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.paymentStatus === "paid_sandbox" && <Badge tone="warning">پرداخت آزمایشی</Badge>}
                    <Badge tone={orderStatus[o.status].tone}>{orderStatus[o.status].label}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{o.items.map((i) => `${i.name} (${i.variantLabel}) × ${faNum(i.qty)}`).join("، ")}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="num font-bold">{toman(o.total)}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {o.status === "pending_payment" && (
                      <form action={manualPaymentAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={o.id} />
                        <input name="reference" placeholder="مرجع تراکنش / رسید" className="h-9 w-44 rounded border border-line-strong px-2 text-sm" aria-label="مرجع پرداخت" />
                        <Button size="sm" variant="secondary">ثبت پرداخت دستی</Button>
                      </form>
                    )}
                    {next.map((s) => (
                      <form key={s} action={orderTransitionAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="to" value={s} />
                        <Button size="sm" variant={s === "cancelled" ? "danger" : "primary"}>{s === "cancelled" ? "لغو و بازگشت موجودی" : `تغییر به «${orderStatus[s].label}»`}</Button>
                      </form>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
