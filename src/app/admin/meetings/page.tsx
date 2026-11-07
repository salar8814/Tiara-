import Link from "next/link";
import { meetingStatusAction } from "@/app/actions/admin";
import { Badge, Button } from "@/components/ui";
import { b2bRules } from "@/data/rules";
import { faTime, jDayLabel } from "@/lib/format";
import { listMeetings } from "@/lib/repo/meetings";
import { getRfqById } from "@/lib/repo/rfqs";
import { meetingStatus } from "@/lib/status";
import { requireStaff } from "@/lib/session";
import { AdminFlash } from "@/components/admin-flash";
import type { MeetingStatus } from "@/lib/types";

export const metadata = { title: "جلسه‌ها" };

const actions: Record<MeetingStatus, { to: MeetingStatus; label: string; danger?: boolean }[]> = {
  requested: [{ to: "confirmed", label: "تأیید جلسه" }, { to: "cancelled", label: "رد / لغو", danger: true }],
  confirmed: [{ to: "completed", label: "برگزار شد" }, { to: "cancelled", label: "لغو", danger: true }],
  cancelled: [],
  completed: [],
};

export default async function AdminMeetings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff("meetings.manage");
  const sp = await searchParams;
  const meetings = listMeetings();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">جلسه‌ها</h1>
      <AdminFlash sp={sp} />
      <p className="text-sm text-muted">تقویم کارشناسان هنوز متصل نیست؛ پس از هماهنگی تلفنی، جلسه را اینجا تأیید کنید تا وضعیت برای مشتری به‌روز شود.</p>
      {meetings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">هنوز درخواست جلسه‌ای ثبت نشده است.</p>
      ) : (
        <ul className="space-y-3">
          {meetings.map((m) => {
            const d = jDayLabel(m.date);
            const rfq = m.rfqId ? getRfqById(m.rfqId) : null;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
                <div>
                  <p className="font-bold text-ink">{d.weekday} {d.day} · ساعت {faTime(m.time)} · {b2bRules.meeting.types.find((t) => t.id === m.type)?.name}</p>
                  <p className="text-muted">{m.company} · {m.contactName} · <span className="ltr">{m.phone}</span>{rfq && <> · <Link href={`/admin/requests/${rfq.code}`} className="ltr font-semibold text-indigo-700 hover:underline">{rfq.code}</Link></>}</p>
                  {m.topic && <p className="mt-1 text-xs text-muted">{m.topic}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={meetingStatus[m.status].tone}>{meetingStatus[m.status].label}</Badge>
                  {actions[m.status].map((a) => (
                    <form key={a.to} action={meetingStatusAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="to" value={a.to} />
                      <Button size="sm" variant={a.danger ? "danger" : "primary"}>{a.label}</Button>
                    </form>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
