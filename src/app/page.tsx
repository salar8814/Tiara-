import Link from "next/link";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { Container, Icon, LinkButton } from "@/components/ui";
import { categories } from "@/data/taxonomy";
import { canUseEmployeePrice } from "@/lib/pricing";
import { listProducts } from "@/lib/repo/products";
import { currentUser } from "@/lib/session";
import type { ProductArt as Art } from "@/lib/types";

export default async function Home() {
  const user = await currentUser();
  const b2c = listProducts({ channel: "b2c" });
  const b2b = listProducts({ channel: "b2b" });
  const featured = b2c.filter((p) => p.variants.some((v) => v.stock > 0)).slice(0, 4);
  const art = (id: string) => [...b2c, ...b2b].find((p) => p.id === id)?.art;
  const catArt: Record<string, string> = {
    fragrance: "p-viana-noir",
    "personal-care": "p-moramora-hand",
    home: "p-candle-handmade",
    "car-care": "p-octane-booster",
    "gift-sets": "b-nowruz",
  };

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="pb-12 pt-10 sm:pb-16 sm:pt-14">
          <p className="text-sm font-semibold text-muted">دنیای تیارا · گروه صنعتی ماموت</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-[1.35] tracking-tight text-ink sm:text-5xl sm:leading-[1.25]">
            محصولات گروه، برای خودتان یا برای سازمانتان.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted sm:text-lg sm:leading-9">
            کارکنان گروه با قیمت ویژه خرید می‌کنند؛ واحدها و شرکت‌ها برای هدیه‌های مناسبتی و تأمین سازمانی استعلام می‌گیرند و با کارشناس فروش جلسه می‌گذارند.
          </p>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <EntryCard
              channel="b2c"
              eyebrow="خرید شخصی"
              title="فروشگاه کارکنان"
              lead="خرید شخصی هر کارمند با قیمت ویژه و پرداخت اینترنتی."
              points={["قیمت مصرف‌کننده و قیمت کارکنان، شفاف و کنار هم", "سبد خرید و پرداخت در همین سامانه", "ارسال به نشانی دلخواه یا تحویل در محل کار"]}
              href="/shop"
              cta="ورود به فروشگاه"
              arts={[art("p-viana-noir"), art("p-moramora-hand"), art("p-candle-handmade")]}
            />
            <EntryCard
              channel="b2b"
              eyebrow="خرید سازمانی"
              title="فروش سازمانی و هدایای مناسبتی"
              lead="برای واحدها و شرکت‌ها؛ قیمت بر اساس تیراژ، سفارشی‌سازی و زمان تحویل."
              points={["کاتالوگ سازمانی با حداقل سفارش و بسته‌های هدیه", "فهرست استعلام چندقلمی و ثبت درخواست قیمت", "رزرو جلسه با کارشناس و پیگیری تا سفارش قطعی"]}
              href="/corporate"
              cta="مشاهدهٔ کاتالوگ سازمانی"
              arts={[art("b-nowruz"), art("b-welcome-kit"), art("b-car-care")]}
            />
          </div>
          {!user && (
            <p className="mt-5 text-sm text-muted">
              کارمند گروه هستید؟{" "}
              <Link href="/login?next=/shop" className="font-semibold text-indigo-700 underline-offset-4 hover:underline">
                با شمارهٔ همراه ثبت‌شده در منابع انسانی وارد شوید
              </Link>{" "}
              تا قیمت کارکنان برایتان فعال شود.
            </p>
          )}
        </Container>
      </section>

      <Container className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-extrabold text-ink">دسته‌های محصول</h2>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => {
            const a = art(catArt[c.id]);
            const href = c.id === "gift-sets" ? "/corporate?category=gift-sets" : `/shop?category=${c.id}`;
            return (
              <li key={c.id}>
                <Link href={href} className="group block overflow-hidden rounded-lg border border-line bg-surface hover:shadow-card">
                  <div className="aspect-[5/4] overflow-hidden">{a && <ProductArt art={a} className="transition-transform duration-500 group-hover:scale-105" />}</div>
                  <div className="px-3.5 py-3">
                    <p className="text-sm font-bold text-ink">{c.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">{c.id === "gift-sets" ? "ویژهٔ خرید سازمانی" : c.description}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>

      <Container className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-ink">پیشنهاد این هفتهٔ فروشگاه کارکنان</h2>
            <p className="mt-1 text-sm text-muted">قیمت‌ها با مالیات بر ارزش افزوده است.</p>
          </div>
          <Link href="/shop" className="flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
            همهٔ محصولات <Icon name="arrow" size={16} />
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} eligible={canUseEmployeePrice(user?.eligibility)} />
          ))}
        </div>
      </Container>

      <Container className="mt-16">
        <div data-channel="b2b" className="rounded-xl border border-line bg-surface p-6 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-sm font-semibold text-clay-700">خرید سازمانی چگونه انجام می‌شود</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-snug text-ink">از استعلام تا سفارش قطعی، هر مرحله روشن است.</h2>
              <p className="mt-3 text-sm leading-7 text-muted">ثبت استعلام تعهد خرید نیست. قیمت نهایی پس از بررسی تیراژ و سفارشی‌سازی در پیشنهاد قیمت اعلام می‌شود.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <LinkButton href="/corporate" size="md">شروع استعلام</LinkButton>
                <LinkButton href="/corporate/meeting" variant="secondary">رزرو جلسه</LinkButton>
              </div>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {[
                ["list", "۱. استعلام", "محصولات و تعداد را به فهرست استعلام اضافه کنید و مناسبت، بودجه و زمان تحویل را بنویسید."],
                ["calendar", "۲. بررسی و جلسه", "کارشناس فروش تا پایان روز کاری بعد تماس می‌گیرد؛ در صورت نیاز جلسه برگزار می‌شود."],
                ["doc", "۳. پیشنهاد قیمت و پیش‌فاکتور", "پیشنهاد قیمت را در همین سامانه می‌بینید و تأیید می‌کنید؛ پیش‌فاکتور صادر می‌شود."],
                ["truck", "۴. سفارش قطعی و تحویل", "پس از پرداخت یا ارسال سفارش خرید، سفارش قطعی و وارد برنامهٔ تولید می‌شود."],
              ].map(([icon, t, d]) => (
                <li key={t} className="rounded-lg bg-canvas p-5">
                  <Icon name={icon} className="text-clay-600" />
                  <h3 className="mt-3 font-bold text-ink">{t}</h3>
                  <p className="mt-1 text-sm leading-7 text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Container>
    </>
  );
}

function EntryCard({
  channel,
  eyebrow,
  title,
  lead,
  points,
  href,
  cta,
  arts,
}: {
  channel: "b2c" | "b2b";
  eyebrow: string;
  title: string;
  lead: string;
  points: string[];
  href: string;
  cta: string;
  arts: (Art | undefined)[];
}) {
  return (
    <div data-channel={channel} className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="grid grid-cols-3 gap-px bg-line">
        {arts.map((a, i) => (
          <div key={i} className="aspect-square overflow-hidden">
            {a ? <ProductArt art={a} className="transition-transform duration-700 group-hover:scale-105" /> : null}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <p className="text-sm font-bold text-accent-700">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink">{title}</h2>
        <p className="mt-2 text-[0.9375rem] text-muted">{lead}</p>
        <ul className="mt-5 space-y-2.5 text-[0.9375rem] text-ink-soft">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5">
              <Icon name="check" size={18} className="mt-1 text-accent-600" />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-7">
          <LinkButton href={href} size="lg" className="w-full sm:w-auto">
            {cta}
            <Icon name="arrow" size={18} />
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
