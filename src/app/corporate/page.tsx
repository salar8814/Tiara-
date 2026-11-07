import type { Metadata } from "next";
import Link from "next/link";
import { B2BCard } from "@/components/b2b-card";
import { FilterForm } from "@/components/filter-form";
import { Container, EmptyState, Icon, LinkButton, PageHeader } from "@/components/ui";
import { categories, occasions } from "@/data/taxonomy";
import { faNum } from "@/lib/format";
import { listProducts } from "@/lib/repo/products";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "کاتالوگ سازمانی" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const moqBands = [
  { id: "", label: "همه" },
  { id: "100", label: "تا ۱۰۰" },
  { id: "300", label: "تا ۳۰۰" },
];

export default async function CorporateCatalog({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const category = one(sp.category);
  const occasion = one(sp.occasion);
  const custom = one(sp.custom) === "1";
  const moq = Number(one(sp.moq)) || 0;
  const q = one(sp.q).trim();
  const user = await currentUser();

  const all = listProducts({ channel: "b2b" }).filter((p) => p.b2b);
  const products = all
    .filter((p) => !category || p.categoryId === category)
    .filter((p) => !occasion || p.occasions.includes(occasion))
    .filter((p) => !custom || p.b2b!.customization.length > 0)
    .filter((p) => !moq || p.b2b!.moq <= moq)
    .filter((p) => !q || `${p.name} ${p.brand} ${p.summary} ${p.components.join(" ")}`.includes(q))
    // bundles first: they are the core of corporate gifting
    .sort((a, b) => (a.kind === b.kind ? a.sort - b.sort : a.kind === "bundle" ? -1 : 1));

  const usedCats = categories.filter((c) => all.some((p) => p.categoryId === c.id));
  const usedOccasions = occasions.filter((o) => all.some((p) => p.occasions.includes(o.id)));
  const filtered = [category, occasion, custom, moq, q].some(Boolean);

  return (
    <Container className="pb-28">
      <PageHeader
        crumbs={[{ href: "/", label: "دنیای تیارا" }, { label: "خرید سازمانی" }]}
        title="کاتالوگ سازمانی"
        lead="قیمت سازمانی به تیراژ، سفارشی‌سازی و زمان تحویل بستگی دارد. محصولات را با تعداد موردنظر به فهرست استعلام اضافه کنید؛ قیمت نهایی در پیشنهاد قیمت اعلام می‌شود."
        action={<LinkButton href="/corporate/meeting" variant="secondary"><Icon name="calendar" size={18} /> رزرو جلسه با کارشناس</LinkButton>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["box", "حداقل سفارش مشخص", "برای هر محصول، حداقل تعداد و اندازهٔ کارتن نمایش داده می‌شود."],
          ["tag", "قیمت پلکانی", user ? "قیمت‌های تقریبی بر اساس تیراژ برای شما نمایش داده می‌شود." : "پس از ورود، قیمت‌های تقریبی بر اساس تیراژ نمایش داده می‌شود."],
          ["doc", "پیشنهاد قیمت رسمی", "پس از بررسی، پیشنهاد قیمت و پیش‌فاکتور در همین سامانه صادر می‌شود."],
        ].map(([icon, t, d]) => (
          <div key={t} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
            <Icon name={icon} className="mt-0.5 text-clay-600" />
            <div className="text-sm">
              <p className="font-bold text-ink">{t}</p>
              <p className="mt-0.5 leading-6 text-muted">{d}</p>
            </div>
          </div>
        ))}
      </div>

      <FilterForm className="group mt-8">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6" aria-label="فیلترها">
            <label className="relative block">
              <span className="sr-only">جست‌وجو</span>
              <Icon name="search" size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-subtle" />
              <input type="search" name="q" defaultValue={q} placeholder="جست‌وجو در کاتالوگ" className="h-11 w-full rounded-md border border-line-strong bg-surface ps-10 pe-3 text-sm focus:border-clay-600 focus:outline-none focus:ring-2 focus:ring-clay-100" />
            </label>
            <FilterGroup title="دسته‌بندی" name="category" value={category} options={[{ id: "", name: "همه" }, ...usedCats.map((c) => ({ id: c.id, name: c.name }))]} />
            <FilterGroup title="مناسبت" name="occasion" value={occasion} options={[{ id: "", name: "همهٔ مناسبت‌ها" }, ...usedOccasions]} />
            <FilterGroup title="حداقل سفارش" name="moq" value={moq ? String(moq) : ""} options={moqBands.map((b) => ({ id: b.id, name: b.label }))} />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" name="custom" value="1" defaultChecked={custom} className="size-4 accent-clay-600" />
              فقط قابل سفارشی‌سازی
            </label>
            <noscript><button className="h-10 w-full rounded-md bg-ink text-sm font-semibold text-white">اعمال فیلتر</button></noscript>
          </aside>

          <div>
            <div className="mb-3 flex items-center justify-between text-sm text-muted">
              <p aria-live="polite"><span className="num font-semibold text-ink">{faNum(products.length)}</span> محصول و بسته</p>
              {filtered && (
                // Full reload on purpose: resets the uncontrolled filter inputs.
                // eslint-disable-next-line @next/next/no-html-link-for-pages
                <a href="/corporate" className="font-semibold text-clay-700 hover:underline">پاک کردن فیلترها</a>
              )}
            </div>
            <div className="transition-opacity group-data-[pending]:opacity-60">
              {products.length === 0 ? (
                <EmptyState title="موردی با این فیلترها پیدا نشد" action={<LinkButton href="/corporate" variant="secondary">نمایش همه</LinkButton>}>
                  اگر محصول موردنظرتان را پیدا نکردید، در فرم استعلام توضیح دهید یا جلسه رزرو کنید.
                </EmptyState>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map((p) => <B2BCard key={p.id} product={p} showTiers={!!user} />)}
                </div>
              )}
            </div>
            <p className="mt-8 text-sm text-muted">
              محصول یا ترکیب خاصی در نظر دارید؟ <Link href="/corporate/meeting" className="font-semibold text-clay-700 hover:underline">با کارشناس فروش سازمانی جلسه بگذارید</Link>.
            </p>
          </div>
        </div>
      </FilterForm>
    </Container>
  );
}

function FilterGroup({ title, name, value, options }: { title: string; name: string; value: string; options: { id: string; name: string }[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-ink">{title}</legend>
      <div className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
        {options.map((o) => (
          <label key={o.id || "all"} className="cursor-pointer">
            <input type="radio" name={name} value={o.id} defaultChecked={value === o.id} className="peer sr-only" />
            <span className="block rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:bg-surface peer-checked:border-clay-600 peer-checked:bg-clay-50 peer-checked:font-semibold peer-checked:text-clay-800 peer-focus-visible:ring-2 peer-focus-visible:ring-clay-200 lg:border-transparent">
              {o.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
