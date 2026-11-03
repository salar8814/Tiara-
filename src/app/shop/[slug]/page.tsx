import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EligibilityBanner } from "@/components/eligibility";
import { PdpBuyBox } from "@/components/pdp-buybox";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { Breadcrumbs, Container, Icon } from "@/components/ui";
import { categoryById } from "@/data/taxonomy";
import { canUseEmployeePrice } from "@/lib/pricing";
import { getProductBySlug, listProducts } from "@/lib/repo/products";
import { currentUser } from "@/lib/session";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = getProductBySlug((await params).slug, "b2c");
  return { title: p?.name ?? "محصول" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = getProductBySlug(slug, "b2c");
  if (!product || product.variants.length === 0) notFound();
  const user = await currentUser();
  const eligible = canUseEmployeePrice(user?.eligibility);
  const cat = categoryById(product.categoryId);
  const related = listProducts({ channel: "b2c" })
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);

  return (
    <Container>
      <div className="pt-6">
        <Breadcrumbs
          items={[
            { href: "/", label: "دنیای تیارا" },
            { href: "/shop", label: "فروشگاه کارکنان" },
            { href: `/shop?category=${product.categoryId}`, label: cat?.name ?? "" },
            { label: product.name },
          ]}
        />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="aspect-square overflow-hidden rounded-xl border border-line">
            <ProductArt art={product.art} label={`تصویر ${product.name}`} />
          </div>
          <p className="mt-2 text-xs text-subtle">تصویر نمادین؛ عکس محصول پس از عکاسی جایگزین می‌شود.</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-muted">{product.brand}</p>
          <h1 className="mt-1 text-2xl font-black leading-snug tracking-tight text-ink sm:text-[2rem]">{product.name}</h1>
          <p className="mt-2 text-[0.9875rem] text-muted">{product.summary}</p>

          <div className="mt-6">
            <PdpBuyBox variants={product.variants} eligible={eligible} />
          </div>

          {!eligible && (
            <div className="mt-6">
              <EligibilityBanner user={user} next={`/shop/${product.slug}`} compact />
            </div>
          )}

          <section className="mt-10 border-t border-line pt-8">
            <h2 className="text-base font-bold text-ink">دربارهٔ محصول</h2>
            <p className="mt-3 text-[0.9375rem] leading-8 text-ink-soft">{product.description}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 rounded-md bg-surface px-3 py-2.5 text-sm text-ink-soft ring-1 ring-line">
                  <Icon name="check" size={16} className="mt-1 text-indigo-600" /> {h}
                </li>
              ))}
            </ul>
          </section>

          {product.channels.includes("b2b") && (
            <div data-channel="b2b" className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-clay-100 bg-clay-50 px-5 py-4">
              <div className="text-sm">
                <p className="font-bold text-clay-800">برای هدیهٔ سازمانی هم موجود است</p>
                <p className="text-clay-700">سفارش از {product.b2b!.moq.toLocaleString("fa-IR")} {product.b2b!.unitLabel}، با امکان سفارشی‌سازی</p>
              </div>
              <Link href={`/corporate/${product.slug}`} className="text-sm font-bold text-clay-700 underline underline-offset-4">
                مشاهده در کاتالوگ سازمانی
              </Link>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-xl font-extrabold text-ink">از همین دسته</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} eligible={eligible} />)}
          </div>
        </section>
      )}
    </Container>
  );
}
