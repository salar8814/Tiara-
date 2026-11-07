import Link from "next/link";
import { notFound } from "next/navigation";
import { assignRfqAction, confirmCorporateOrderAction, corporateOrderTransitionAction, rfqTransitionAction } from "@/app/actions/admin";
import { AdminFlash } from "@/components/admin-flash";
import { can } from "@/lib/authz";
import { listStaff } from "@/lib/repo/users";
import { requireStaff } from "@/lib/session";
import { QuotationBuilder } from "@/components/admin-forms";
import { Timeline } from "@/components/timeline";
import { Badge, Button, KeyValue } from "@/components/ui";
import { b2bRules, storeRules } from "@/data/rules";
import { occasionById } from "@/data/taxonomy";
import { addDays, faNum, faTime, jDate, jDayLabel, tehranIsoDate, toman } from "@/lib/format";
import { leadTimeDays, tierFor } from "@/lib/pricing";
import { listMeetings } from "@/lib/repo/meetings";
import { getProductById } from "@/lib/repo/products";
import { getCorporateOrderForRfq, getRfqByCode, listQuotations } from "@/lib/repo/rfqs";
import {
  corporateOrderStatus,
  corporateOrderTransitions,
  meetingStatus,
  quotationStatus,
  rfqEventLabels,
  rfqStatus,
  rfqTransitions,
} from "@/lib/status";

export const metadata = { title: "جزئیات استعلام" };

export default async function AdminRequest({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireStaff();
  if (!can(user, "rfq.manage") && !can(user, "corporate_orders.confirm") && !can(user, "corporate_orders.fulfil")) notFound();
  const { code } = await params;
  const sp = await searchParams;
  const rfq = getRfqByCode(code);
  if (!rfq) notFound();
  const quotations = listQuotations(rfq.id);
  const order = getCorporateOrderForRfq(rfq.id);
  const meetings = listMeetings({ rfqId: rfq.id });
  const canQuote = ["in_review", "quoted", "declined"].includes(rfq.status) && can(user, "quotes.issue");
  const salesStaff = listStaff().filter((s) => s.role === "sales" || s.role === "admin");
  const manual = rfqTransitions[rfq.status].filter((s) => ["in_review", "closed"].includes(s));

  // Suggest prices from the tier table and lead time from customisation.
  const suggested = rfq.items.map((i) => {
    const p = getProductById(i.productId);
    if (!p?.b2b || i.customization.length) return null;
    return tierFor(p.b2b.tiers, i.qty)?.unitPrice ?? null;
  });
  const lead = Math.max(
    ...rfq.items.map((i) => {
      const p = getProductById(i.productId);
      if (!p?.b2b) return 10;
      const ids = p.b2b.customization.filter((c) => i.customization.includes(c.label)).map((c) => c.id);
      return leadTimeDays(p.b2b, ids);
    }),
  );
  const defaultDelivery = [rfq.deadline, addDays(tehranIsoDate(), lead + 2)].sort().reverse()[0];

  return (
    <div className="space-y-6">
      <Link href="/admin/requests" className="text-sm font-semibold text-indigo-700 hover:underline">← همهٔ استعلام‌ها</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="ltr text-2xl font-black text-ink">{rfq.code}</h1>
        <Badge tone={rfqStatus[rfq.status].tone}>{rfqStatus[rfq.status].label}</Badge>
      </div>
      <AdminFlash sp={sp} />
      {can(user, "rfq.manage") && <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-5 py-3 text-sm">
        <p>مسئول پیگیری: <strong>{rfq.assignedTo ? (salesStaff.find((s) => s.mobile === rfq.assignedTo)?.name ?? rfq.assignedTo) : "تعیین نشده"}</strong></p>
        <form action={assignRfqAction} className="flex items-center gap-2">
          <input type="hidden" name="code" value={rfq.code} />
          <select name="assignee" defaultValue={rfq.assignedTo ?? ""} className="h-9 rounded border border-line-strong bg-surface px-2 text-sm" aria-label="مسئول پیگیری">
            <option value="">بدون مسئول</option>
            {Array.from(new Map(salesStaff.map((s) => [s.mobile, s])).values()).map((s) => <option key={s.mobile} value={s.mobile}>{s.name ?? s.mobile}</option>)}
          </select>
          <Button size="sm" variant="secondary">ثبت مسئول</Button>
        </form>
      </section>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 font-bold text-ink">درخواست</h2>
            <KeyValue
              rows={[
                ["سازمان", `${rfq.company}${rfq.department ? ` · ${rfq.department}` : ""}`],
                ["تماس", <span key="c">{rfq.contactName} · <span className="ltr">{rfq.phone}</span>{rfq.email && <> · <span className="ltr">{rfq.email}</span></>}</span>],
                ["مناسبت", occasionById(rfq.occasion)?.name ?? rfq.occasion],
                ["بودجه", b2bRules.budgetRanges.find((b) => b.id === rfq.budget)?.name ?? rfq.budget],
                ["مهلت تحویل", `${jDate(rfq.deadline)} (آماده‌سازی استاندارد ${faNum(lead)} روز)`],
                ["سفارشی‌سازی", rfq.customization ?? "—"],
                ["توضیحات", rfq.notes ?? "—"],
                ["حساب کاربری", rfq.userId ? "متصل" : "مهمان"],
              ]}
            />
            <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
              {rfq.items.map((i) => (
                <li key={i.productId} className="py-2.5">
                  <div className="flex justify-between"><span className="font-semibold">{i.name}</span><span className="num">{faNum(i.qty)} {i.unitLabel}</span></div>
                  {i.customization.length > 0 && <p className="text-xs text-clay-700">{i.customization.join("، ")}</p>}
                  {i.note && <p className="text-xs text-muted">{i.note}</p>}
                </li>
              ))}
            </ul>
            {manual.length > 0 && can(user, "rfq.manage") && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {manual.map((s) => (
                  <form key={s} action={rfqTransitionAction} className="flex gap-2">
                    <input type="hidden" name="code" value={rfq.code} />
                    <input type="hidden" name="to" value={s} />
                    {s === "closed" && <input name="note" placeholder="دلیل بستن" className="h-9 rounded border border-line-strong px-2 text-sm" aria-label="دلیل بستن" />}
                    <Button size="sm" variant={s === "closed" ? "danger" : "primary"}>{s === "in_review" ? "شروع بررسی" : "بستن درخواست"}</Button>
                  </form>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 font-bold text-ink">پیشنهاد قیمت</h2>
            {quotations.length > 0 && (
              <ul className="mb-4 space-y-1 text-sm">
                {quotations.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-canvas px-3 py-2">
                    <span>نسخهٔ {faNum(q.version)} · {toman(q.total)} · اعتبار تا {jDate(q.validUntil)}{q.proformaNumber && <> · پیش‌فاکتور <span className="ltr">{q.proformaNumber}</span></>}</span>
                    <Badge tone={quotationStatus[q.status].tone}>{quotationStatus[q.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {canQuote ? (
              <QuotationBuilder code={rfq.code} items={rfq.items} suggested={suggested} vatRate={storeRules.vatRate} defaultDelivery={defaultDelivery} />
            ) : !can(user, "quotes.issue") ? (
              <p className="text-sm text-muted">صدور پیشنهاد قیمت با نقش فروش سازمانی است.</p>
            ) : rfq.status === "submitted" ? (
              <p className="text-sm text-muted">برای صدور پیشنهاد قیمت، ابتدا درخواست را «در حال بررسی» کنید.</p>
            ) : (
              <p className="text-sm text-muted">در این وضعیت امکان صدور پیشنهاد جدید نیست.</p>
            )}
          </section>

          {rfq.status === "approved" && can(user, "corporate_orders.confirm") && (
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="mb-2 font-bold text-ink">ثبت سفارش قطعی</h2>
              <p className="mb-3 text-sm text-muted">واحد مالی: پس از دریافت پیش‌پرداخت یا سفارش خرید رسمی، مرجع آن را ثبت کنید تا سفارش قطعی شود.</p>
              <form action={confirmCorporateOrderAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="code" value={rfq.code} />
                <input name="reference" required placeholder="شمارهٔ فیش / سفارش خرید" className="h-10 flex-1 rounded border border-line-strong px-3 text-sm" aria-label="مرجع پرداخت یا سفارش خرید" />
                <Button>قطعی کردن سفارش</Button>
              </form>
            </section>
          )}

          {order && (
            <section className="rounded-lg border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-ink">سفارش قطعی <span className="ltr">{order.code}</span></h2>
                <Badge tone={corporateOrderStatus[order.status].tone}>{corporateOrderStatus[order.status].label}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{toman(order.total)} · مرجع {order.reference}</p>
              <div className="mt-3 flex gap-2">
                {can(user, "corporate_orders.fulfil") && corporateOrderTransitions[order.status].map((s) => (
                  <form key={s} action={corporateOrderTransitionAction}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="code" value={rfq.code} />
                    <input type="hidden" name="to" value={s} />
                    <Button size="sm">تغییر به «{corporateOrderStatus[s].label}»</Button>
                  </form>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 font-bold text-ink">جلسه‌ها</h2>
            {meetings.length === 0 ? <p className="text-sm text-muted">جلسه‌ای ثبت نشده.</p> : (
              <ul className="space-y-2 text-sm">
                {meetings.map((m) => {
                  const d = jDayLabel(m.date);
                  return (
                    <li key={m.id} className="rounded bg-canvas p-3">
                      {d.weekday} {d.day} · {faTime(m.time)}
                      <Badge tone={meetingStatus[m.status].tone} className="ms-2">{meetingStatus[m.status].label}</Badge>
                    </li>
                  );
                })}
                <li><Link href="/admin/meetings" className="text-xs font-semibold text-indigo-700 hover:underline">مدیریت جلسه‌ها</Link></li>
              </ul>
            )}
          </section>
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-4 font-bold text-ink">تاریخچه</h2>
            <Timeline events={rfq.events} labels={rfqEventLabels} />
          </section>
        </div>
      </div>
    </div>
  );
}
