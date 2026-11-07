import Link from "next/link";
import { isStaff } from "@/lib/authz";
import { currentUser } from "@/lib/session";
import { BasketLinks, NavLinks } from "./header-client";
import { Container, Icon } from "./ui";

const nav = [
  { href: "/shop", label: "فروشگاه کارکنان", match: "/shop" },
  { href: "/corporate", label: "خرید سازمانی", match: "/corporate" },
  { href: "/corporate/track", label: "پیگیری درخواست", match: "/corporate/track" },
];

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="تیارا — صفحهٔ اصلی">
      <span className="grid size-9 place-items-center rounded-md bg-ink text-[0.95rem] font-black text-white" aria-hidden>
        ت
      </span>
      <span className="leading-tight">
        <span className="block text-[1.0625rem] font-extrabold tracking-tight text-ink">تیارا</span>
        <span className="block text-[0.6875rem] font-medium text-muted">از گروه صنعتی ماموت</span>
      </span>
    </Link>
  );
}

function initials(name: string | null) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  return parts[0].slice(0, 2);
}

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        رفتن به محتوای اصلی
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Wordmark />
          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 md:flex">
            <NavLinks items={nav} />
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <BasketLinks />
          {isStaff(user) && (
            <Link href="/admin" className="hidden h-10 items-center rounded-md px-3 text-sm font-semibold text-ink-soft hover:bg-sunken sm:flex">
              پنل مدیریت
            </Link>
          )}
          {user ? (
            <Link
              href="/account"
              className="ms-1 flex h-10 items-center gap-2 rounded-full border border-line ps-1 pe-3 text-sm font-semibold text-ink hover:border-line-strong"
            >
              <span className="grid size-8 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                {initials(user.name) ?? <Icon name="user" size={16} />}
              </span>
              <span className="hidden sm:inline">حساب من</span>
            </Link>
          ) : (
            <Link href="/login" className="ms-1 flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft">
              ورود
            </Link>
          )}
        </div>
      </Container>
      <nav aria-label="ناوبری اصلی (موبایل)" className="border-t border-line md:hidden">
        <Container className="flex gap-1 overflow-x-auto py-1.5">
          <NavLinks items={nav} />
        </Container>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <Container className="grid gap-10 py-12 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Wordmark />
          <p className="max-w-xs text-muted">دنیای تیارا؛ فروشگاه کارکنان و فروش سازمانی محصولات گروه صنعتی ماموت.</p>
        </div>
        <div>
          <h2 className="mb-3 font-bold text-ink">خرید شخصی</h2>
          <ul className="space-y-2 text-muted">
            <li><Link className="hover:text-ink" href="/shop">همهٔ محصولات</Link></li>
            <li><Link className="hover:text-ink" href="/cart">سبد خرید</Link></li>
            <li><Link className="hover:text-ink" href="/account?tab=orders">سفارش‌های من</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-bold text-ink">خرید سازمانی</h2>
          <ul className="space-y-2 text-muted">
            <li><Link className="hover:text-ink" href="/corporate">کاتالوگ سازمانی</Link></li>
            <li><Link className="hover:text-ink" href="/corporate/inquiry">فهرست استعلام</Link></li>
            <li><Link className="hover:text-ink" href="/corporate/meeting">رزرو جلسه با کارشناس</Link></li>
            <li><Link className="hover:text-ink" href="/corporate/track">پیگیری درخواست</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-bold text-ink">پشتیبانی</h2>
          <ul className="space-y-2 text-muted">
            <li>فروش سازمانی: شنبه تا چهارشنبه، ۹ تا ۱۷</li>
            <li>پاسخ به استعلام‌ها تا پایان روز کاری بعد</li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="py-4 text-xs text-subtle">نسخهٔ نمونهٔ اولیه — برخی سرویس‌ها (پرداخت، پیامک، سامانهٔ منابع انسانی) هنوز متصل نیستند.</Container>
      </div>
    </footer>
  );
}
