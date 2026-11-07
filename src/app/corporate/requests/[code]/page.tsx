import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { decideQuotationAction } from "@/app/actions/corporate";
import { Timeline } from "@/components/timeline";
import { Badge, Button, Container, Icon, KeyValue, LinkButton, Notice, PageHeader, Stepper, Textarea } from "@/components/ui";
import { b2bRules, storeRules } from "@/data/rules";
import { occasionById } from "@/data/taxonomy";
import { canAccessRfq, canDecideRfq } from "@/lib/access";
import { faNum, faTime, jDate, jDateTime, jDayLabel, toman } from "@/lib/format";
import { listMeetings } from "@/lib/repo/meetings";
import { getCorporateOrderForRfq, getRfqByCode, listQuotations } from "@/lib/repo/rfqs";
import { currentUser } from "@/lib/session";
import { corporateOrderStatus, meetingStatus, quotationStatus, rfqEventLabels, rfqFlow, rfqStatus } from "@/lib/status";

export const metadata: Metadata = { title: "پیگیری درخواست سازمانی" };

type P = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> };


export default async function RequestPage({ params, searchParams }: P) {
  const { code } = await params;
  const sp = await searchParams;
  const rfq = getRfqByCode(decodeURIComponent(code));
  if (!rfq) notFound();
  const user = await currentUser();
  if (!(await canAccessRfq(rfq, user))) redirect(`/corporate/track?code=${encodeURIComponent(rfq.code)}`);

  const quotations = listQuotations(rfq.id);
  const latest = quotations[0];
  const order = getCorporateOrderForRfq(rfq.id);
  const meetings = listMeetings({ rfqId: rfq.id });
  const st = rfqStatus[rfq.status];
  const terminal = rfq.status === "declined" || rfq.status === "closed";
  const current = terminal ? Math.max(1, rfqFlow.indexOf(latest ? "quoted" : "in_review")) : rfqFlow.indexOf(rfq.status);
  const steps = [
    { id: "submitted", label: "استعلام" },
    { id: "in_review", label: "بررسی کارشناس" },
    { id: "quoted", label: "پیشنهاد قیمت" },
    { id: "approved", label: "پیش‌فاکتور" },
    { id: "converted", label: "سفارش قطعی" },
  ];

  return (
    <Container className="max-w-5xl">
      {sp.new ? (
        <div className="pt-12 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success"><Icon name="check" size={30} /></span>
          <h1 className="mt-5 text-2xl font-black text-ink sm:text-3xl">درخواست استعلام شما ثبت شد</h1>
          <p className="mt-2 text-muted">کد پیگیری را نگه دارید؛ با این کد و شمارهٔ تماس می‌توانید وضعیت را ببینید.</p>
          <p className="ltr mx-auto mt-5 inline-block rounded-md border border-line bg-surface px-5 py-2.5 text-lg font-black tracking-wider text-ink">{rfq.code}</p>
          <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-line bg-surface p-5 text-start">
            <h2 className="font-bold text-ink">گام‌های بعدی</h2>
            <ol className="mt-3 space-y-3 text-sm text-ink-soft">
              {[
                `کارشناس فروش سازمانی تا پایان ${faNum(b2bRules.responseSlaDays)} روز کاری آینده تماس می‌گیرد و تیراژ و سفارشی‌سازی را نهایی می‌کند.`,
                "پیشنهاد قیمت در همین صفحه منتشر می‌شود و با تأیید شما پیش‌فاکتور صادر می‌شود.",
                "پس از پرداخت یا ارسال سفارش خرید، سفارش قطعی و وارد برنامهٔ تولید می‌شود.",
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-clay-50 text-xs font-bold text-clay-700">{(i + 1).toLocaleString("fa-IR")}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          {meetings.length === 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <LinkButton href={`/corporate/meeting?rfq=${rfq.code}`}><Icon name="calendar" size={18} /> رزرو جلسه برای این استعلام</LinkButton>
              <LinkButton href="/corporate" variant="secondary">بازگشت به کاتالوگ</LinkButton>
            </div>
          )}
          <hr className="mt-12 border-line" />
        </div>
      ) : (
        <PageHeader
          crumbs={[{ href: "/", label: "دنیای تیارا" }, { href: user ? "/account?tab=requests" : "/corporate/track", label: "درخواست‌های سازمانی" }, { label: rfq.code }]}
          title={<>درخواست <span className="ltr">{rfq.code}</span></>}
          lead={`${rfq.company} · ثبت در ${jDateTime(rfq.createdAt)}`}
          action={<Badge tone={st.tone}>{st.label}</Badge>}
        />
      )}

      {sp.meeting === "requested" && <Notice tone="success" className="mt-6">درخواست جلسه ثبت شد و منتظر تأیید کارشناس است.</Notice>}
      {sp.decision === "approved" && <Notice tone="success" className="mt-6">پیشنهاد قیمت تأیید شد و پیش‌فاکتور صادر شد. سفارش پس از پرداخت یا دریافت سفارش خرید قطعی می‌شود.</Notice>}
      {sp.decision === "declined" && <Notice tone="info" className="mt-6">پاسخ شما ثبت شد. کارشناس فروش برای بازنگری با شما تماس می‌گیرد.</Notice>}
      {sp.error === "quotation" && <Notice tone="danger" className="mt-6">این پیشنهاد قیمت دیگر قابل تأیید نیست (منقضی، پس‌گرفته یا جایگزین شده است).</Notice>}
      {sp.error === "owner" && <Notice tone="danger" className="mt-6">تأیید پیشنهاد فقط با ورود همان شمارهٔ همراهی که درخواست را ثبت کرده ممکن است.</Notice>}

      <section className="mt-6 rounded-lg border border-line bg-surface p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-ink">وضعیت درخواست</h2>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <Stepper steps={steps} current={current} tone={terminal ? "danger" : "accent"} />
        <p className="mt-5 text-sm text-muted">{st.hint}</p>
      </section>

      {latest && (
        <section className="mt-6 rounded-lg border border-line bg-surface" aria-labelledby="quote-title">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <h2 id="quote-title" className="font-bold text-ink">پیشنهاد قیمت · نسخهٔ {faNum(latest.version)}</h2>
            <Badge tone={quotationStatus[latest.status].tone}>{quotationStatus[latest.status].label}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-canvas text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 text-start font-semibold">شرح</th>
                  <th className="px-3 py-2.5 text-start font-semibold">تعداد</th>
                  <th className="px-3 py-2.5 text-start font-semibold">قیمت واحد</th>
                  <th className="px-5 py-2.5 text-end font-semibold">مبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {latest.lines.map((l) => (
                  <tr key={l.productId}>
                    <td className="px-5 py-3"><p className="font-semibold text-ink">{l.name}</p>{l.note && <p className="text-xs text-muted">{l.note}</p>}</td>
                    <td className="num px-3 py-3">{faNum(l.qty)} {l.unitLabel}</td>
                    <td className="num px-3 py-3">{toman(l.unitPrice)}</td>
                    <td className="num px-5 py-3 text-end font-semibold">{toman(l.unitPrice * l.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-6 border-t border-line p-5 sm:grid-cols-2">
            <div className="text-sm text-muted">
              <p>تاریخ تحویل پیشنهادی: <strong className="text-ink">{jDate(latest.deliveryDate)}</strong></p>
              <p>اعتبار پیشنهاد تا: <strong className="text-ink">{jDate(latest.validUntil)}</strong></p>
              {latest.terms && <p className="mt-2 leading-7">{latest.terms}</p>}
            </div>
            <KeyValue
              rows={[
                ["جمع", toman(latest.subtotal)],
                ...(latest.discount ? [["تخفیف", `−${toman(latest.discount)}`] as [string, string]] : []),
                [`مالیات بر ارزش افزوده (${faNum(storeRules.vatRate * 100)}٪)`, toman(latest.vat)],
                [<strong key="t" className="text-ink">مبلغ نهایی</strong>, <strong key="v" className="num text-base">{toman(latest.total)}</strong>],
              ]}
            />
          </div>
          {latest.status === "issued" && !canDecideRfq(rfq, user) && (
            <div className="border-t border-line bg-canvas p-5 text-sm text-ink-soft">
              برای تأیید یا رد این پیشنهاد، با شمارهٔ همراه درخواست‌کننده وارد شوید.{" "}
              <Link href={`/login?next=${encodeURIComponent(`/corporate/requests/${rfq.code}`)}`} className="font-semibold text-clay-700 hover:underline">ورود</Link>
              <p className="mt-1 text-xs text-muted">اگر شمارهٔ ثبت‌شده تلفن ثابت است، تأیید را به کارشناس فروش اعلام کنید.</p>
            </div>
          )}
          {latest.status === "issued" && canDecideRfq(rfq, user) && (
            <form action={decideQuotationAction} className="border-t border-line bg-canvas p-5">
              <input type="hidden" name="code" value={rfq.code} />
              <input type="hidden" name="quotationId" value={latest.id} />
              <label htmlFor="q-note" className="mb-1.5 block text-sm font-semibold text-ink-soft">یادداشت برای کارشناس (اختیاری)</label>
              <Textarea id="q-note" name="note" rows={2} maxLength={500} placeholder="مثلاً شمارهٔ سفارش خرید داخلی یا درخواست تغییر" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button name="decision" value="approved">تأیید پیشنهاد و دریافت پیش‌فاکتور</Button>
                <Button name="decision" value="declined" variant="secondary">درخواست بازنگری / رد</Button>
              </div>
              <p className="mt-2 text-xs text-muted">تأیید پیشنهاد، پیش‌فاکتور صادر می‌کند؛ سفارش پس از پرداخت یا ارسال سفارش خرید قطعی می‌شود.</p>
            </form>
          )}
          {latest.status === "approved" && latest.proformaNumber && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas p-5">
              <p className="text-sm text-ink-soft">پیش‌فاکتور <span className="ltr font-bold text-ink">{latest.proformaNumber}</span> صادر شد.</p>
              <LinkButton href={`/corporate/requests/${rfq.code}/proforma`} variant="secondary" size="sm"><Icon name="doc" size={16} /> مشاهده و چاپ پیش‌فاکتور</LinkButton>
            </div>
          )}
          {quotations.length > 1 && (
            <details className="border-t border-line px-5 py-3 text-sm">
              <summary className="cursor-pointer font-semibold text-muted">نسخه‌های قبلی ({faNum(quotations.length - 1)})</summary>
              <ul className="mt-2 space-y-1 text-muted">
                {quotations.slice(1).map((q) => (
                  <li key={q.id}>نسخهٔ {faNum(q.version)} · {toman(q.total)} · {quotationStatus[q.status].label}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {order && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/25 bg-success-soft p-5">
          <div className="text-sm text-success">
            <p className="font-bold">سفارش قطعی <span className="ltr">{order.code}</span></p>
            <p>مبلغ {toman(order.total)} · مرجع {order.reference} · ثبت در {jDate(order.createdAt)}</p>
          </div>
          <Badge tone={corporateOrderStatus[order.status].tone}>{corporateOrderStatus[order.status].label}</Badge>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-4 font-bold text-ink">اقلام استعلام</h2>
            <ul className="divide-y divide-line">
              {rfq.items.map((i) => (
                <li key={i.productId} className="px-5 py-3.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-ink">{i.name}</span>
                    <span className="num text-ink-soft">{faNum(i.qty)} {i.unitLabel}</span>
                  </div>
                  {i.customization.length > 0 && <p className="mt-1 text-xs text-clay-700">سفارشی‌سازی: {i.customization.join("، ")}</p>}
                  {i.note && <p className="mt-0.5 text-xs text-muted">{i.note}</p>}
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-3">
              <KeyValue
                rows={[
                  ["سازمان", `${rfq.company}${rfq.department ? ` · ${rfq.department}` : ""}`],
                  ["درخواست‌کننده", rfq.contactName],
                  ["شمارهٔ تماس", <span key="p" className="ltr">{rfq.phone}</span>],
                  ["مناسبت", occasionById(rfq.occasion)?.name ?? rfq.occasion],
                  ["بودجه", b2bRules.budgetRanges.find((b) => b.id === rfq.budget)?.name ?? rfq.budget],
                  ["مهلت تحویل", jDate(rfq.deadline)],
                  ...(rfq.customization ? [["سفارشی‌سازی", rfq.customization] as [string, string]] : []),
                ]}
              />
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-ink">جلسه‌ها</h2>
              {!["converted", "closed"].includes(rfq.status) && (
                <Link href={`/corporate/meeting?rfq=${rfq.code}`} className="text-sm font-semibold text-clay-700 hover:underline">رزرو جلسه</Link>
              )}
            </div>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted">جلسه‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-3">
                {meetings.map((m) => {
                  const d = jDayLabel(m.date);
                  return (
                    <li key={m.id} className="rounded-md bg-canvas p-3 text-sm">
                      <p className="font-semibold text-ink">{d.weekday} {d.day} · ساعت {faTime(m.time)}</p>
                      <p className="text-xs text-muted">{b2bRules.meeting.types.find((t) => t.id === m.type)?.name}</p>
                      <Badge tone={meetingStatus[m.status].tone} className="mt-2">{meetingStatus[m.status].label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-4 font-bold text-ink">تاریخچه</h2>
            <Timeline events={rfq.events} labels={rfqEventLabels} />
          </section>
        </div>
      </div>
    </Container>
  );
}
