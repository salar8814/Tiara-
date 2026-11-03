"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInquiry } from "./stores";
import { Container, Icon, btn } from "./ui";

/** Persistent inquiry summary on catalog pages (hidden on the inquiry form itself). */
export function InquiryBar() {
  const inq = useInquiry();
  const path = usePathname();
  const show = inq.hydrated && inq.count > 0 && (path === "/corporate" || /^\/corporate\/[^/]+$/.test(path)) && !["/corporate/inquiry", "/corporate/meeting", "/corporate/track"].includes(path);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-4">
      <Container>
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur sm:px-5">
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Icon name="list" className="text-clay-600" />
            اقلام انتخاب‌شده برای استعلام: <strong className="num text-ink">{inq.count.toLocaleString("fa-IR")} قلم</strong>
          </p>
          <div className="flex gap-2">
            <Link href="/corporate/meeting" className={btn("secondary", "sm")}>رزرو جلسه</Link>
            <Link href="/corporate/inquiry" className={btn("primary", "sm")}>تکمیل و ثبت استعلام</Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
