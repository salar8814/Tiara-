import Link from "next/link";
import { VariantRow } from "@/components/admin-forms";
import { ProductArt } from "@/components/product-art";
import { Badge } from "@/components/ui";
import { categoryById } from "@/data/taxonomy";
import { faNum } from "@/lib/format";
import { can } from "@/lib/authz";
import { listProducts } from "@/lib/repo/products";
import { reconcile } from "@/lib/repo/inventory";
import { requireStaff } from "@/lib/session";
import { Notice } from "@/components/ui";

export const metadata = { title: "محصولات" };

export default async function AdminProducts() {
  const user = await requireStaff();
  const canPrice = can(user, "catalog.edit");
  const canStock = can(user, "inventory.adjust");
  if (!canPrice && !canStock) return <Notice tone="danger">شما به این بخش دسترسی ندارید.</Notice>;
  const products = listProducts({ includeInactive: true });
  const drift = reconcile();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-ink">محصولات، قیمت و موجودی</h1>
        <p className="mt-1 text-sm text-muted">قیمت‌ها به تومان و با مالیات است. تغییرات بلافاصله در فروشگاه اعمال می‌شود؛ سفارش‌های ثبت‌شده با قیمت زمان ثبت باقی می‌مانند. موجودی فقط با «تغییر ±» و ذکر دلیل اصلاح می‌شود و هر تغییر در دفتر موجودی ثبت می‌شود.</p>
      </div>
      {drift.length > 0 ? (
        <Notice tone="danger">مغایرت موجودی با دفتر موجودی در {faNum(drift.length)} گزینه — موضوع را بررسی کنید.</Notice>
      ) : (
        <p className="text-xs text-success">موجودی همهٔ گزینه‌ها با دفتر موجودی مطابقت دارد.</p>
      )}
      <ul className="space-y-3">
        {products.map((p) => (
          <li key={p.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="size-12 overflow-hidden rounded border border-line"><ProductArt art={p.art} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{p.name}</p>
                <p className="text-xs text-muted">{categoryById(p.categoryId)?.name} · {p.channels.map((c) => (c === "b2c" ? "فروشگاه کارکنان" : "سازمانی")).join(" + ")}{p.b2b && ` · حداقل سفارش ${faNum(p.b2b.moq)}`}</p>
              </div>
              {!p.active && <Badge tone="danger">غیرفعال</Badge>}
              {canPrice && <Link href={`/admin/products/${p.id}`} className="text-sm font-semibold text-indigo-700 hover:underline">تنظیمات محصول</Link>}
            </div>
            {p.variants.length > 0 ? (
              <div className="mt-2 divide-y divide-line border-t border-line">
                {p.variants.map((v) => <VariantRow key={v.id} v={v} canPrice={canPrice} canStock={canStock} />)}
              </div>
            ) : (
              <p className="mt-3 border-t border-line pt-3 text-xs text-muted">بستهٔ سازمانی — قیمت و موجودی در هر پیشنهاد قیمت تعیین می‌شود.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
