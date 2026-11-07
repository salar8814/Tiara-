import { manualPaymentAction, orderStatusAction, refundAction } from "@/app/actions/admin";
import { AdminFlash } from "@/components/admin-flash";
import { Badge, Button, FilterChip } from "@/components/ui";
import { storeRules } from "@/data/rules";
import { can } from "@/lib/authz";
import { faNum, jDateTime, toman } from "@/lib/format";
import { listOrders } from "@/lib/repo/orders";
import { getUser } from "@/lib/repo/users";
import { requireStaff } from "@/lib/session";
import { orderStatus, orderTransitions, paymentStatusLabel } from "@/lib/status";
import type { OrderStatus } from "@/lib/types";

export const metadata = { title: "سفارش‌ها" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; error?: string; ok?: string }> }) {
  const user = await requireStaff("orders.view");
  const sp = await searchParams;
  const status = sp.status && sp.status in orderStatus ? (sp.status as OrderStatus) : null;
  const all = listOrders();
  const orders = sp.status === "refund_pending" ? all.filter((o) => o.paymentStatus === "refund_pending") : status ? all.filter((o) => o.status === status) : all;
  const refunds = all.filter((o) => o.paymentStatus === "refund_pending").length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">سفارش‌های فروشگاه کارکنان</h1>
      <AdminFlash sp={sp} />
      <nav className="flex flex-wrap gap-1.5" aria-label="فیلتر وضعیت">
        <FilterChip href="/admin/orders" active={!sp.status} label={`همه (${faNum(all.length)})`} />
        {(Object.keys(orderStatus) as OrderStatus[]).map((s) => (
          <FilterChip key={s} href={`/admin/orders?status=${s}`} active={status === s} label={`${orderStatus[s].label} (${faNum(all.filter((o) => o.status === s).length)})`} />
        ))}
        <FilterChip href="/admin/orders?status=refund_pending" active={sp.status === "refund_pending"} label={`بازگشت وجه معوق (${faNum(refunds)})`} />
      </nav>
      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">سفارشی با این وضعیت نیست.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const u = getUser(o.userId);
            const next = orderTransitions[o.status].filter((s) => {
              if (s === "paid") return false; // only via payment recording
              if (s === "cancelled") return can(user, o.status === "pending_payment" ? "orders.cancel_unpaid" : "orders.cancel_paid");
              return can(user, "orders.fulfil");
            });
            const ps = paymentStatusLabel[o.paymentStatus];
            return (
              <li key={o.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="ltr text-start font-bold text-ink">{o.code}</p>
                    <p className="text-xs text-muted">{u?.name ?? u?.mobile} · {jDateTime(o.createdAt)} · {storeRules.deliveryMethods.find((d) => d.id === o.deliveryMethod)?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={ps.tone}>{ps.label}</Badge>
                    <Badge tone={orderStatus[o.status].tone}>{orderStatus[o.status].label}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{o.items.map((i) => `${i.name} (${i.variantLabel}) × ${faNum(i.qty)}`).join("، ")}</p>
                {(o.paymentRef || o.refundRef) && (
                  <p className="mt-1 text-xs text-muted">
                    {o.paymentRef && <>مرجع پرداخت <span className="ltr">{o.paymentRef}</span></>}
                    {o.refundRef && <> · مرجع بازگشت وجه <span className="ltr">{o.refundRef}</span></>}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="num font-bold">{toman(o.total)}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {o.status === "pending_payment" && can(user, "payments.record") && (
                      <form action={manualPaymentAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={o.id} />
                        <input name="reference" required minLength={4} placeholder="مرجع تراکنش / رسید بانکی" className="h-9 w-48 rounded border border-line-strong px-2 text-sm" aria-label="مرجع پرداخت" />
                        <Button size="sm" variant="secondary">ثبت پرداخت دستی</Button>
                      </form>
                    )}
                    {o.paymentStatus === "refund_pending" && can(user, "refunds.record") && (
                      <form action={refundAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={o.id} />
                        <input name="reference" required minLength={4} placeholder="مرجع واریز بازگشت وجه" className="h-9 w-48 rounded border border-line-strong px-2 text-sm" aria-label="مرجع بازگشت وجه" />
                        <Button size="sm" variant="secondary">ثبت بازگشت وجه</Button>
                      </form>
                    )}
                    {next.map((s) => (
                      <form key={s} action={orderStatusAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="to" value={s} />
                        <Button size="sm" variant={s === "cancelled" ? "danger" : "primary"}>
                          {s === "cancelled" ? (o.status === "pending_payment" ? "لغو و آزادسازی موجودی" : "لغو (نیازمند بازگشت وجه)") : `تغییر به «${orderStatus[s].label}»`}
                        </Button>
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
