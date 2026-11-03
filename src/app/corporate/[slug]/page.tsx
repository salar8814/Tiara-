import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { B2BConfigurator } from "@/components/b2b-configurator";
import { ProductArt } from "@/components/product-art";
import { Breadcrumbs, Container, Icon } from "@/components/ui";
import { occasionById } from "@/data/taxonomy";
import { getProductBySlug } from "@/lib/repo/products";
import { currentUser } from "@/lib/session";
import { b2bSnapshot } from "@/lib/snapshot";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = getProductBySlug((await params).slug, "b2b");
  return { title: p ? `${p.name} — سازمانی` : "محصول سازمانی" };
}

export default async function CorporateProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = getProductBySlug(slug, "b2b");
  if (!product?.b2b) notFound();
  const user = await currentUser();
  const snap = b2bSnapshot(!!user)[product.id];

  return (
    <Container className="pb-28">
      <div className="pt-6">
        <Breadcrumbs items={[{ href: "/", label: "دنیای تیارا" }, { href: "/corporate", label: "کاتالوگ سازمانی" }, { label: product.name }]} />
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="aspect-square overflow-hidden rounded-xl border border-line">
            <ProductArt art={product.art} label={`تصویر ${product.name}`} />
          </div>
          {product.components.length > 0 && (
            <section className="mt-5 rounded-lg border border-line bg-surface p-5">
              <h2 className="text-sm font-bold text-ink">محتویات بسته</h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                {product.components.map((c) => (
                  <li key={c} className="flex items-center gap-2"><Icon name="check" size={16} className="text-clay-600" /> {c}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-muted">{product.brand} · {product.kind === "bundle" ? "بستهٔ هدیهٔ سازمانی" : "محصول سازمانی"}</p>
          <h1 className="mt-1 text-2xl font-black leading-snug tracking-tight text-ink sm:text-[2rem]">{product.name}</h1>
          <p className="mt-2 text-[0.9875rem] leading-8 text-muted">{product.description}</p>
          {product.occasions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.occasions.map((o) => (
                <Link key={o} href={`/corporate?occasion=${o}`} className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-line hover:ring-line-strong">
                  {occasionById(o)?.name}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-8">
            <B2BConfigurator product={snap} signedIn={!!user} />
          </div>
          {product.channels.includes("b2c") && (
            <p className="mt-8 border-t border-line pt-5 text-sm text-muted">
              خرید شخصی؟ <Link href={`/shop/${product.slug}`} className="font-semibold text-indigo-700 hover:underline">این محصول در فروشگاه کارکنان</Link>
            </p>
          )}
        </div>
      </div>
    </Container>
  );
}
