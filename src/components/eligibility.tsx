import Link from "next/link";
import type { User } from "@/lib/types";
import { Icon, cx } from "./ui";

/** Shows the shopper's employee-pricing state. Eligibility comes from the HR record at login. */
export function EligibilityBanner({ user, next = "/shop", compact }: { user: User | null; next?: string; compact?: boolean }) {
  const state = !user
    ? {
        tone: "neutral",
        icon: "shield",
        title: "قیمت کارکنان پس از ورود فعال می‌شود",
        body: "با شمارهٔ همراهی که در منابع انسانی گروه ثبت شده وارد شوید. مرور محصولات و افزودن به سبد بدون ورود هم ممکن است.",
        action: { href: `/login?next=${encodeURIComponent(next)}`, label: "ورود کارکنان" },
      }
    : user.eligibility === "eligible"
      ? {
          tone: "success",
          icon: "check",
          title: `قیمت کارکنان برای شما فعال است`,
          body: `${user.name ?? ""}${user.unit ? ` · ${user.unit}` : ""}${user.company ? ` · ${user.company}` : ""}`,
          action: null,
        }
      : user.eligibility === "pending"
        ? {
            tone: "warning",
            icon: "clock",
            title: "حساب کارمندی شما در انتظار فعال‌سازی است",
            body: "پرونده‌تان در منابع انسانی ثبت شده اما هنوز فعال نشده است. تا آن زمان امکان خرید از فروشگاه کارکنان وجود ندارد.",
            action: null,
          }
        : user.eligibility === "ineligible"
          ? {
              tone: "danger",
              icon: "info",
              title: "دسترسی شما به فروشگاه کارکنان فعال نیست",
              body: "بر اساس سوابق منابع انسانی، همکاری شما فعال نیست. اگر این اطلاعات درست نیست با منابع انسانی تماس بگیرید.",
              action: null,
            }
          : {
              tone: "info",
              icon: "building",
              title: "این شماره در فهرست کارکنان گروه نیست",
              body: "فروشگاه کارکنان فقط برای همکاران گروه است. برای خرید سازمانی و هدیهٔ مناسبتی از کاتالوگ سازمانی استفاده کنید.",
              action: { href: "/corporate", label: "کاتالوگ سازمانی" },
            };

  const tones: Record<string, string> = {
    neutral: "border-line bg-surface text-ink-soft",
    success: "border-success/20 bg-success-soft text-success",
    warning: "border-warning/25 bg-warning-soft text-warning",
    danger: "border-danger/25 bg-danger-soft text-danger",
    info: "border-info/20 bg-info-soft text-info",
  };

  return (
    <div role="status" className={cx("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-4 py-3", tones[state.tone], compact && "py-2.5")}>
      <Icon name={state.icon} className="shrink-0" />
      <div className="min-w-0 flex-1 text-sm leading-6">
        <p className="font-bold">{state.title}</p>
        {state.body && <p className={cx("opacity-90", state.tone === "neutral" && "text-muted")}>{state.body}</p>}
      </div>
      {state.action && (
        <Link href={state.action.href} className="inline-flex h-9 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft">
          {state.action.label}
        </Link>
      )}
    </div>
  );
}
