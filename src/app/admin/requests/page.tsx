import Link from "next/link";
import { Badge, FilterChip } from "@/components/ui";
import { occasionById } from "@/data/taxonomy";
import { faNum, jDate } from "@/lib/format";
import { listRfqs } from "@/lib/repo/rfqs";
import { rfqStatus } from "@/lib/status";
import type { RfqStatus } from "@/lib/types";

export const metadata = { title: "استعلام‌ها" };

export default async function AdminRequests({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status && sp.status in rfqStatus ? (sp.status as RfqStatus) : null;
  const all = listRfqs();
  const rfqs = status ? all.filter((r) => r.status === status) : all;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">استعلام‌ها و پیشنهاد قیمت</h1>
      <nav className="flex flex-wrap gap-1.5" aria-label="فیلتر وضعیت">
        <FilterChip href="/admin/requests" active={!status} label={`همه (${faNum(all.length)})`} />
        {(Object.keys(rfqStatus) as RfqStatus[]).map((s) => (
          <FilterChip key={s} href={`/admin/requests?status=${s}`} active={status === s} label={`${rfqStatus[s].label} (${faNum(all.filter((r) => r.status === s).length)})`} />
        ))}
      </nav>
      {rfqs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">درخواستی با این وضعیت نیست.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start font-semibold">کد</th>
                <th className="px-4 py-2.5 text-start font-semibold">سازمان</th>
                <th className="px-4 py-2.5 text-start font-semibold">مناسبت</th>
                <th className="px-4 py-2.5 text-start font-semibold">اقلام</th>
                <th className="px-4 py-2.5 text-start font-semibold">مهلت تحویل</th>
                <th className="px-4 py-2.5 text-start font-semibold">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rfqs.map((r) => (
                <tr key={r.id} className="hover:bg-canvas">
                  <td className="px-4 py-3"><Link href={`/admin/requests/${r.code}`} className="ltr font-bold text-indigo-700 hover:underline">{r.code}</Link></td>
                  <td className="px-4 py-3">{r.company}<span className="block text-xs text-muted">{r.contactName}</span></td>
                  <td className="px-4 py-3">{occasionById(r.occasion)?.name}</td>
                  <td className="num px-4 py-3">{faNum(r.items.length)} قلم · {faNum(r.items.reduce((s, i) => s + i.qty, 0))}</td>
                  <td className="px-4 py-3">{jDate(r.deadline)}</td>
                  <td className="px-4 py-3"><Badge tone={rfqStatus[r.status].tone}>{rfqStatus[r.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
