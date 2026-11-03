import type { Metadata } from "next";
import { Container, Icon, LinkButton } from "@/components/ui";
import { b2bRules } from "@/data/rules";
import { faTime, jDayLabel } from "@/lib/format";

export const metadata: Metadata = { title: "درخواست جلسه ثبت شد" };

export default async function MeetingRequested({ searchParams }: { searchParams: Promise<{ date?: string; time?: string; type?: string }> }) {
  const { date, time, type } = await searchParams;
  const valid = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && time && /^\d{2}:\d{2}$/.test(time);
  const label = valid ? jDayLabel(date) : null;
  const typeName = b2bRules.meeting.types.find((t) => t.id === type)?.name;
  return (
    <Container className="max-w-2xl py-16 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-warning-soft text-warning"><Icon name="calendar" size={28} /></span>
      <h1 className="mt-6 text-2xl font-black text-ink">درخواست جلسه ثبت شد</h1>
      {label && (
        <p className="mt-3 text-muted">
          {typeName} · {label.weekday} {label.day}، ساعت {faTime(time!)}
        </p>
      )}
      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted">
        این زمان برای شما نگه داشته شده اما هنوز قطعی نیست. کارشناس فروش سازمانی تا پایان روز کاری بعد تماس می‌گیرد و جلسه را تأیید می‌کند.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <LinkButton href="/corporate">بازگشت به کاتالوگ سازمانی</LinkButton>
        <LinkButton href="/account?tab=requests" variant="secondary">درخواست‌های من</LinkButton>
      </div>
    </Container>
  );
}
