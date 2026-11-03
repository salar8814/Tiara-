import Link from "next/link";
import { categoryById } from "@/data/taxonomy";
import { discountPercent } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { QuickAdd } from "./cart-buttons";
import { ProductArt } from "./product-art";
import { Badge, Money, cx } from "./ui";

export function stockState(p: Product) {
  const total = p.variants.reduce((s, v) => s + v.stock, 0);
  if (total === 0) return { label: "ناموجود", tone: "neutral" as const, out: true };
  const low = p.variants.length === 1 && total <= 5;
  return low ? { label: `تنها ${total.toLocaleString("fa-IR")} عدد باقی مانده`, tone: "warning" as const, out: false } : null;
}

export function ProductCard({ product, eligible }: { product: Product; eligible: boolean }) {
  const inStock = product.variants.filter((v) => v.stock > 0);
  const base = (inStock.length ? inStock : product.variants).reduce((a, b) => (a.employeePrice <= b.employeePrice ? a : b));
  const multi = product.variants.length > 1;
  const stock = stockState(product);
  const href = `/shop/${product.slug}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-shadow hover:shadow-card">
      <Link href={href} className="relative block aspect-[4/3.4] overflow-hidden" tabIndex={-1} aria-hidden>
        <ProductArt art={product.art} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        {stock && (
          <span className="absolute start-3 top-3">
            <Badge tone={stock.tone} className="bg-surface/95">{stock.label}</Badge>
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-muted">{product.brand} · {categoryById(product.categoryId)?.short}</p>
        <h3 className="mt-1 text-[0.9875rem] font-bold leading-7 text-ink">
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-[0.8125rem] text-muted">{multi ? `${product.variants.length.toLocaleString("fa-IR")} گزینه` : base.label}</p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
          {multi && <span className="text-xs text-muted">از</span>}
          <Money value={base.employeePrice} className={cx("text-base font-extrabold", eligible ? "text-ink" : "text-ink")} />
          <Money value={base.retailPrice} strike className="text-xs" />
        </div>
        <p className="mt-0.5 text-xs font-semibold text-success">
          قیمت کارکنان · {discountPercent(base).toLocaleString("fa-IR")}٪ کمتر از قیمت مصرف‌کننده
        </p>

        <div className="relative z-10 mt-auto pt-4">
          {multi || stock?.out ? (
            <Link
              href={href}
              className="flex h-9 items-center justify-center rounded-md border border-line-strong text-sm font-semibold text-ink hover:border-ink-soft"
            >
              {stock?.out ? "مشاهدهٔ جزئیات" : "انتخاب گزینه"}
            </Link>
          ) : (
            <QuickAdd variantId={base.id} max={Math.min(base.maxPerOrder, base.stock)} />
          )}
        </div>
      </div>
    </article>
  );
}
