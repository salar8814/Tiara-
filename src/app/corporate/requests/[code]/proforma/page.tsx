import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Container, LinkButton } from "@/components/ui";
import { storeRules } from "@/data/rules";
import { canAccessRfq } from "@/lib/access";
import { faNum, jDate, toman } from "@/lib/format";
import { getRfqByCode, listQuotations } from "@/lib/repo/rfqs";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "پیش‌فاکتور" };

export default async function ProformaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const rfq = getRfqByCode(code);
  if (!rfq) notFound();
  const user = await currentUser();
  if (!(await canAccessRfq(rfq, user))) redirect(`/corporate/track?code=${encodeURIComponent(code)}`);
  const q = listQuotations(rfq.id).find((x) => x.status === "approved" && x.proformaNumber);
  if (!q) notFound();

  return (
    <Container className="max-w-4xl py-8 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-between gap-2 print:hidden">
        <LinkButton href={`/corporate/requests/${code}`} variant="secondary" size="sm">بازگشت به درخواست</LinkButton>
        <PrintButton />
      </div>
      <article className="rounded-lg border border-line bg-surface p-6 text-sm sm:p-10 print:border-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="text-xl font-black text-ink">پیش‌فاکتور</p>
            <p className="mt-1 text-muted">تیارا · گروه صنعتی ماموت</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-start">
            <dt className="text-muted">شمارهٔ پیش‌فاکتور</dt><dd className="ltr font-bold">{q.proformaNumber}</dd>
            <dt className="text-muted">تاریخ صدور</dt><dd>{jDate(q.decidedAt ?? q.createdAt)}</dd>
            <dt className="text-muted">اعتبار تا</dt><dd>{jDate(q.validUntil)}</dd>
            <dt className="text-muted">مرجع استعلام</dt><dd className="ltr">{rfq.code}</dd>
          </dl>
        </header>
        <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-bold text-muted">خریدار</p>
            <p className="font-bold text-ink">{rfq.company}</p>
            {rfq.department && <p className="text-ink-soft">{rfq.department}</p>}
            <p className="text-ink-soft">{rfq.contactName} · <span className="ltr">{rfq.phone}</span></p>
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-muted">فروشنده</p>
            <p className="font-bold text-ink">تیارا — فروش سازمانی</p>
            <p className="text-ink-soft">اطلاعات حقوقی، شناسهٔ ملی و شمارهٔ اقتصادی پس از تأیید واحد مالی درج می‌شود.</p>
          </div>
        </section>
        <table className="mt-6 w-full">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="py-2 text-start font-semibold">ردیف</th>
              <th className="py-2 text-start font-semibold">شرح کالا</th>
              <th className="py-2 text-start font-semibold">تعداد</th>
              <th className="py-2 text-start font-semibold">قیمت واحد (تومان)</th>
              <th className="py-2 text-end font-semibold">مبلغ (تومان)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {q.lines.map((l, i) => (
              <tr key={l.productId}>
                <td className="num py-2.5">{faNum(i + 1)}</td>
                <td className="py-2.5">{l.name}{l.note && <span className="block text-xs text-muted">{l.note}</span>}</td>
                <td className="num py-2.5">{faNum(l.qty)} {l.unitLabel}</td>
                <td className="num py-2.5">{faNum(l.unitPrice)}</td>
                <td className="num py-2.5 text-end">{faNum(l.unitPrice * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ms-auto mt-6 grid max-w-xs grid-cols-2 gap-y-1.5 border-t border-line pt-4">
          <dt className="text-muted">جمع</dt><dd className="num text-end">{toman(q.subtotal)}</dd>
          {q.discount > 0 && (<><dt className="text-muted">تخفیف</dt><dd className="num text-end">−{toman(q.discount)}</dd></>)}
          <dt className="text-muted">ارزش افزوده ({faNum(storeRules.vatRate * 100)}٪)</dt><dd className="num text-end">{toman(q.vat)}</dd>
          <dt className="font-bold">مبلغ قابل پرداخت</dt><dd className="num text-end text-base font-black">{toman(q.total)}</dd>
        </dl>
        <footer className="mt-8 space-y-1 border-t border-line pt-4 text-xs leading-6 text-muted">
          <p>تاریخ تحویل: {jDate(q.deliveryDate)}</p>
          {q.terms && <p>شرایط: {q.terms}</p>}
          <p>این سند پیش‌فاکتور است و سفارش پس از پرداخت یا دریافت سفارش خرید رسمی و تأیید واحد فروش قطعی می‌شود.</p>
        </footer>
      </article>
    </Container>
  );
}
