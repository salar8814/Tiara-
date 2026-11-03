import type { Metadata } from "next";
import Link from "next/link";
import { TrackForm } from "@/components/track-form";
import { Badge, Container, PageHeader } from "@/components/ui";
import { guestRfqCodes } from "@/lib/access";
import { jDate } from "@/lib/format";
import { getRfqByCode, listRfqs } from "@/lib/repo/rfqs";
import { currentUser } from "@/lib/session";
import { rfqStatus } from "@/lib/status";
import type { Rfq } from "@/lib/types";

export const metadata: Metadata = { title: "پیگیری درخواست سازمانی" };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const user = await currentUser();
  const mine: Rfq[] = user ? listRfqs({ userId: user.id }) : [];
  const fromCookie = (await guestRfqCodes()).map((c) => getRfqByCode(c)).filter((r): r is Rfq => !!r && !mine.some((m) => m.id === r.id));
  const list = [...mine, ...fromCookie];

  return (
    <Container className="max-w-3xl">
      <PageHeader
        crumbs={[{ href: "/", label: "دنیای تیارا" }, { href: "/corporate", label: "خرید سازمانی" }, { label: "پیگیری درخواست" }]}
        title="پیگیری درخواست سازمانی"
        lead="کد پیگیری استعلام و شمارهٔ تماسی را که هنگام ثبت وارد کرده‌اید بنویسید."
      />
      <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <TrackForm defaultCode={code ?? ""} />
      </section>
      {list.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-bold text-ink">درخواست‌های اخیر شما</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {list.map((r) => (
              <li key={r.id}>
                <Link href={`/corporate/requests/${r.code}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-canvas">
                  <span>
                    <span className="ltr block font-bold text-ink">{r.code}</span>
                    <span className="text-xs text-muted">{r.company} · {jDate(r.createdAt)}</span>
                  </span>
                  <Badge tone={rfqStatus[r.status].tone}>{rfqStatus[r.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!user && (
        <p className="mt-6 text-sm text-muted">
          با <Link href="/login?next=/account?tab=requests" className="font-semibold text-clay-700 hover:underline">ورود با همان شمارهٔ تماس</Link> همهٔ درخواست‌هایتان یک‌جا نمایش داده می‌شود.
        </p>
      )}
    </Container>
  );
}
