import type { Metadata } from "next";
import { EligibilityBanner } from "@/components/eligibility";
import { FilterForm } from "@/components/filter-form";
import { ProductCard } from "@/components/product-card";
import { Container, EmptyState, Icon, LinkButton, PageHeader, cx } from "@/components/ui";
import { categories } from "@/data/taxonomy";
import { faNum } from "@/lib/format";
import { canUseEmployeePrice, discountPercent } from "@/lib/pricing";
import { listProducts } from "@/lib/repo/products";
import { currentUser } from "@/lib/session";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "فروشگاه کارکنان" };

const priceBands = [
  { id: "", label: "همهٔ قیمت‌ها" },
  { id: "lt300", label: "تا ۳۰۰ هزار تومان", min: 0, max: 300_000 },
  { id: "300-700", label: "۳۰۰ تا ۷۰۰ هزار تومان", min: 300_000, max: 700_000 },
  { id: "gt700", label: "بیش از ۷۰۰ هزار تومان", min: 700_000, max: Infinity },
];

const sorts = [
  { id: "", label: "پیشنهاد تیارا" },
  { id: "price-asc", label: "ارزان‌ترین" },
  { id: "price-desc", label: "گران‌ترین" },
  { id: "discount", label: "بیشترین تخفیف کارکنان" },
];

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const minPrice = (p: Product) => Math.min(...p.variants.map((v) => v.employeePrice));
const maxDiscount = (p: Product) => Math.max(...p.variants.map(discountPercent));

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const category = one(sp.category);
  const price = one(sp.price);
  const inStock = one(sp.stock) === "1";
  const sort = one(sp.sort);
  const user = await currentUser();

  const all = listProducts({ channel: "b2c" });
  const band = priceBands.find((b) => b.id === price);
  let products = all.filter((p) => {
    if (category && p.categoryId !== category) return false;
    if (inStock && !p.variants.some((v) => v.stock > 0)) return false;
    if (band && "min" in band && band.min !== undefined) {
      const m = minPrice(p);
      if (m < band.min || m >= band.max!) return false;
    }
    if (q) {
      const hay = `${p.name} ${p.brand} ${p.summary} ${p.variants.map((v) => v.label).join(" ")}`;
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (sort === "price-asc") products = [...products].sort((a, b) => minPrice(a) - minPrice(b));
  if (sort === "price-desc") products = [...products].sort((a, b) => minPrice(b) - minPrice(a));
  if (sort === "discount") products = [...products].sort((a, b) => maxDiscount(b) - maxDiscount(a));

  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  const shopCats = categories.filter((c) => counts.has(c.id));
  const activeFilters = [q, category, price, inStock ? "1" : "", sort].filter(Boolean).length;

  return (
    <Container>
      <PageHeader
        crumbs={[{ href: "/", label: "دنیای تیارا" }, { label: "فروشگاه کارکنان" }]}
        title="فروشگاه کارکنان"
        lead="قیمت کارکنان ویژهٔ پرسنل گروه است و کنار قیمت مصرف‌کننده نمایش داده می‌شود. همهٔ قیمت‌ها با مالیات بر ارزش افزوده است."
      />
      <EligibilityBanner user={user} />

      <FilterForm className="group mt-6">
        <fieldset className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <legend className="sr-only">دسته‌بندی</legend>
          <div className="flex gap-2 pb-1">
            {[{ id: "", name: "همه", count: all.length }, ...shopCats.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id)! }))].map((c) => (
              <label key={c.id || "all"} className="cursor-pointer">
                <input type="radio" name="category" value={c.id} defaultChecked={category === c.id} className="peer sr-only" />
                <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink-soft peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-200">
                  {c.name}
                  <span className="num text-xs font-medium opacity-60">{faNum(c.count)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-60">
            <span className="sr-only">جست‌وجو در محصولات</span>
            <Icon name="search" size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="جست‌وجو: عطر، شمع، کرم دست…"
              className="h-11 w-full rounded-md border border-line-strong bg-surface ps-10 pe-3 text-[0.9375rem] placeholder:text-subtle focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-muted">قیمت</span>
            <select name="price" defaultValue={price} className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm">
              {priceBands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-muted">مرتب‌سازی</span>
            <select name="sort" defaultValue={sort} className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm">
              {sorts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm">
            <input type="checkbox" name="stock" value="1" defaultChecked={inStock} className="size-4 accent-indigo-600" />
            فقط کالاهای موجود
          </label>
          <noscript>
            <button className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-white">اعمال</button>
          </noscript>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-muted">
          <p aria-live="polite">
            <span className="num font-semibold text-ink">{faNum(products.length)}</span> محصول
            <span className="ms-2 hidden text-xs group-data-[pending]:inline">در حال به‌روزرسانی…</span>
          </p>
          {activeFilters > 0 && (
            <a href="/shop" className="font-semibold text-indigo-700 hover:underline">پاک کردن فیلترها</a>
          )}
        </div>

        <div className={cx("mt-3 transition-opacity group-data-[pending]:opacity-60")}>
          {products.length === 0 ? (
            <EmptyState
              title="محصولی با این فیلترها پیدا نشد"
              icon={<Icon name="search" />}
              action={<LinkButton href="/shop" variant="secondary">نمایش همهٔ محصولات</LinkButton>}
            >
              عبارت جست‌وجو را کوتاه‌تر کنید یا فیلتر قیمت و موجودی را بردارید.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} eligible={canUseEmployeePrice(user?.eligibility)} />
              ))}
            </div>
          )}
        </div>
      </FilterForm>
    </Container>
  );
}
