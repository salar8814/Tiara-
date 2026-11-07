import Link from "next/link";
import { Badge, Icon } from "@/components/ui";
import { faNum, toman } from "@/lib/format";
import { integrationStatus } from "@/lib/integrations";
import { listMeetings } from "@/lib/repo/meetings";
import { listOrders } from "@/lib/repo/orders";
import { listProducts } from "@/lib/repo/products";
import { listRfqs } from "@/lib/repo/rfqs";
import { requireStaff } from "@/lib/session";
import { reconcile } from "@/lib/repo/inventory";
import { Notice } from "@/components/ui";

const stateBadge = {
  connected: { label: "متصل", tone: "success" as const },
  sandbox: { label: "آزمایشی", tone: "warning" as const },
  demo_data: { label: "دادهٔ نمونه", tone: "warning" as const },
  not_connected: { label: "متصل نیست", tone: "danger" as const },
};

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requireStaff("staff.dashboard");
  const denied = (await searchParams).denied;
  const drift = reconcile();
  const orders = listOrders();
  const rfqs = listRfqs();
  const meetings = listMeetings();
  const products = listProducts({ includeInactive: true });
  const lowStock = products.flatMap((p) => p.variants.filter((v) => v.stock <= 5).map((v) => ({ p, v })));
  const paidRevenue = orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0);
  const refundsDue = orders.filter((o) => o.paymentStatus === "refund_pending");
  const sandboxRevenue = orders.filter((o) => o.paymentStatus === "paid_sandbox").reduce((s, o) => s + o.total, 0);

  const kpis = [
    { label: "در انتظار پرداخت", value: orders.filter((o) => o.status === "pending_payment").length, href: "/admin/orders?status=pending_payment" },
    { label: "آمادهٔ پردازش", value: orders.filter((o) => o.status === "paid").length, href: "/admin/orders?status=paid" },
    { label: "استعلام جدید", value: rfqs.filter((r) => r.status === "submitted").length, href: "/admin/requests?status=submitted" },
    { label: "جلسهٔ منتظر تأیید", value: meetings.filter((m) => m.status === "requested").length, href: "/admin/meetings" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-ink">داشبورد</h1>
      {denied && <Notice tone="danger">نقش شما اجازهٔ دسترسی به آن بخش را ندارد.</Notice>}
      {drift.length > 0 && <Notice tone="danger">مغایرت موجودی با دفتر موجودی در {faNum(drift.length)} گزینه.</Notice>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
            <p className="text-sm text-muted">{k.label}</p>
            <p className="num mt-1 text-2xl font-black text-ink">{faNum(k.value)}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 font-bold text-ink">فروش فروشگاه کارکنان</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">پرداخت واقعی تطبیق‌شده</dt><dd className="num font-bold">{toman(paidRevenue)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">پرداخت آزمایشی (شبیه‌ساز)</dt><dd className="num font-bold text-warning">{toman(sandboxRevenue)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">بازگشت وجه معوق</dt><dd className="num font-bold text-danger">{faNum(refundsDue.length)} سفارش · {toman(refundsDue.reduce((s, o) => s + o.total, 0))}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">تعداد کل سفارش‌ها</dt><dd className="num font-bold">{faNum(orders.length)}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink">موجودی کم یا تمام‌شده</h2>
            <Link href="/admin/products" className="text-sm font-semibold text-indigo-700 hover:underline">مدیریت موجودی</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted">همهٔ کالاها موجودی کافی دارند.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {lowStock.map(({ p, v }) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <span>{p.name} <span className="text-muted">· {v.label}</span></span>
                  <Badge tone={v.stock === 0 ? "danger" : "warning"}>{v.stock === 0 ? "ناموجود" : `${faNum(v.stock)} عدد`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-4 font-bold text-ink">وضعیت اتصال‌ها</h2>
        <ul className="divide-y divide-line">
          {integrationStatus().map((i) => (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5 text-sm">
              <div className="max-w-xl">
                <p className="font-semibold text-ink">{i.name}</p>
                <p className="text-muted">{i.detail}</p>
              </div>
              <Badge tone={stateBadge[i.state].tone}>{stateBadge[i.state].label}</Badge>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-muted"><Icon name="info" size={16} /> راهنمای اتصال هر سرویس در docs/INTEGRATIONS.md آمده است.</p>
      </section>
    </div>
  );
}
