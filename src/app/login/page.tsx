import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Container, Icon } from "@/components/ui";
import { demoDirectory } from "@/data/demo-directory";
import { otpMode } from "@/lib/integrations";
import { currentUser, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "ورود" };

const statusLabel = { active: "فعال — واجد شرایط", pending: "در انتظار فعال‌سازی", inactive: "همکاری پایان‌یافته" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "/account");
  if (await currentUser()) redirect(next);
  const demo = otpMode() === "display";

  return (
    <Container className="max-w-5xl py-10 sm:py-16">
      <div className="grid overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-[1fr_1fr]">
        <div className="p-6 sm:p-10">
          <h1 className="text-2xl font-black text-ink">ورود به دنیای تیارا</h1>
          <p className="mt-2 text-sm leading-7 text-muted">
            با شمارهٔ همراه وارد شوید. اگر کارمند گروه باشید، شرایط شما از سوابق منابع انسانی بررسی و قیمت کارکنان فعال می‌شود. مشتریان سازمانی هم با همین روش درخواست‌هایشان را پیگیری می‌کنند.
          </p>
          <div className="mt-8">
            <LoginForm next={next} />
          </div>
        </div>
        <div className="border-t border-line bg-canvas p-6 sm:p-10 lg:border-s lg:border-t-0">
          <h2 className="font-bold text-ink">پس از ورود چه اتفاقی می‌افتد؟</h2>
          <ul className="mt-4 space-y-4 text-sm">
            {[
              ["shield", "بررسی شرایط کارمندی", "وضعیت همکاری شما از سامانهٔ منابع انسانی خوانده می‌شود: فعال، در انتظار فعال‌سازی یا غیرفعال."],
              ["tag", "قیمت کارکنان", "برای کارکنان فعال، قیمت ویژه در سبد و پرداخت اعمال می‌شود."],
              ["building", "درخواست‌های سازمانی", "استعلام‌هایی که با همین شماره ثبت کرده‌اید به حساب شما متصل می‌شوند."],
            ].map(([icon, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-indigo-700 ring-1 ring-line"><Icon name={icon} size={18} /></span>
                <span>
                  <span className="block font-semibold text-ink">{t}</span>
                  <span className="text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ul>

          {demo && (
            <div className="mt-8 rounded-lg border border-dashed border-ink/25 bg-surface p-4">
              <p className="text-sm font-bold text-ink">
                <span className="me-2 rounded bg-ink px-1.5 text-[0.6875rem] text-white">نمونهٔ اولیه</span>
                فهرست نمونهٔ کارکنان
              </p>
              <p className="mt-1 text-xs leading-6 text-muted">سامانهٔ منابع انسانی هنوز متصل نیست. برای آزمودن حالت‌های مختلف از این شماره‌ها استفاده کنید؛ هر شمارهٔ دیگری «مشتری سازمانی» شناخته می‌شود.</p>
              <ul className="mt-3 divide-y divide-line text-xs">
                {demoDirectory.map((d) => (
                  <li key={d.mobile} className="flex items-center justify-between gap-2 py-2">
                    <span className="ltr font-semibold text-ink">{d.mobile}</span>
                    <span className="text-muted">{d.name} · {d.admin ? "مدیر سامانه" : statusLabel[d.status]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
