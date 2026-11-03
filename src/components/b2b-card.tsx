import Link from "next/link";
import { faNum, toman } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductArt } from "./product-art";
import { Badge } from "./ui";

export function B2BCard({ product, showTiers }: { product: Product; showTiers: boolean }) {
  const b = product.b2b!;
  const href = `/corporate/${product.slug}`;
  const from = b.tiers.length ? b.tiers[b.tiers.length - 1].unitPrice : null;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-shadow hover:shadow-card">
      <div className="relative aspect-[4/3.2] overflow-hidden">
        <ProductArt art={product.art} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className="absolute start-3 top-3 flex gap-1.5">
          {product.kind === "bundle" && <Badge tone="clay" className="bg-surface/95">بستهٔ هدیه</Badge>}
          {b.customization.length > 0 && <Badge className="bg-surface/95">قابل سفارشی‌سازی</Badge>}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-muted">{product.brand}</p>
        <h3 className="mt-1 text-[0.9875rem] font-bold leading-7 text-ink">
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">{product.name}</Link>
        </h3>
        <p className="line-clamp-2 text-[0.8125rem] leading-6 text-muted">{product.summary}</p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-canvas px-3 py-2">
            <dt className="text-muted">حداقل سفارش</dt>
            <dd className="num mt-0.5 font-bold text-ink">{faNum(b.moq)} {b.unitLabel}</dd>
          </div>
          <div className="rounded-md bg-canvas px-3 py-2">
            <dt className="text-muted">آماده‌سازی</dt>
            <dd className="num mt-0.5 font-bold text-ink">از {faNum(b.leadTimeDays)} روز کاری</dd>
          </div>
        </dl>

        <div className="mt-3 rounded-md border border-clay-100 bg-clay-50 px-3 py-2 text-[0.8125rem] font-semibold text-clay-700">
          {b.priceMode === "quote"
            ? "قیمت بر اساس تیراژ و سفارشی‌سازی، در پیشنهاد قیمت"
            : showTiers && from
              ? <>قیمت پلکانی از <span className="num">{toman(from)}</span> (بدون مالیات)</>
              : "قیمت پلکانی برای کاربران واردشده نمایش داده می‌شود"}
        </div>
      </div>
    </article>
  );
}
