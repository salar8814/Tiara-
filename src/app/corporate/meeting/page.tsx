import type { Metadata } from "next";
import Link from "next/link";
import { MeetingForm } from "@/components/meeting-form";
import { Container, PageHeader } from "@/components/ui";
import { canAccessRfq } from "@/lib/access";
import { faNum, jDayLabel } from "@/lib/format";
import { bookableDays, takenSlots } from "@/lib/repo/meetings";
import { getRfqByCode } from "@/lib/repo/rfqs";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "رزرو جلسه با کارشناس فروش" };

export default async function MeetingPage({ searchParams }: { searchParams: Promise<{ rfq?: string }> }) {
  const { rfq: rfqCode } = await searchParams;
  const user = await currentUser();
  const rfqCandidate = rfqCode ? getRfqByCode(rfqCode) : null;
  const rfq = rfqCandidate && (await canAccessRfq(rfqCandidate, user)) ? rfqCandidate : null;
  const days = bookableDays();
  const taken = Array.from(takenSlots(days));

  return (
    <Container>
      <PageHeader
        crumbs={[{ href: "/", label: "دنیای تیارا" }, { href: "/corporate", label: "خرید سازمانی" }, { label: "رزرو جلسه" }]}
        title="رزرو جلسه با کارشناس فروش سازمانی"
        lead="یک بازهٔ زمانی انتخاب کنید و اطلاعات درخواست را کامل کنید. کارشناس پیش از جلسه با شما تماس می‌گیرد و زمان را تأیید می‌کند."
      />
      {rfq && (
        <section className="mb-6 rounded-lg border border-clay-100 bg-clay-50 p-5">
          <p className="text-sm font-bold text-clay-800">
            استعلام <span className="ltr">{rfq.code}</span> ثبت شد. زمان جلسه را برای بررسی این استعلام انتخاب کنید.
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm text-clay-800 sm:grid-cols-2">
            {rfq.items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3 border-b border-dashed border-clay-200 py-1.5">
                <span>{i.name}</span>
                <span className="num">{faNum(i.qty)} {i.unitLabel}</span>
              </li>
            ))}
          </ul>
          <Link href={`/corporate/requests/${rfq.code}?new=1`} className="mt-3 inline-block text-sm font-semibold text-clay-700 underline underline-offset-4">
            فعلاً بدون جلسه، مشاهدهٔ وضعیت استعلام
          </Link>
        </section>
      )}
      <MeetingForm
        days={days.map((iso) => ({ iso, ...jDayLabel(iso) }))}
        taken={taken}
        rfqCode={rfq?.code ?? null}
        defaults={{
          company: rfq?.company ?? user?.company,
          contactName: rfq?.contactName ?? user?.name,
          phone: rfq?.phone ?? user?.mobile,
          topic: rfq ? `بررسی استعلام ${rfq.code}` : "",
        }}
      />
    </Container>
  );
}
