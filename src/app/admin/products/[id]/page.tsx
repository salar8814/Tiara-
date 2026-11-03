import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductSettingsForm } from "@/components/admin-forms";
import { getProductById } from "@/lib/repo/products";

export const metadata = { title: "تنظیمات محصول" };

export default async function AdminProduct({ params }: { params: Promise<{ id: string }> }) {
  const p = getProductById((await params).id);
  if (!p) notFound();
  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/admin/products" className="text-sm font-semibold text-indigo-700 hover:underline">← بازگشت به محصولات</Link>
      <h1 className="text-2xl font-black text-ink">{p.name}</h1>
      <section className="rounded-lg border border-line bg-surface p-5">
        <ProductSettingsForm id={p.id} active={p.active} summary={p.summary} b2b={p.b2b} />
      </section>
      <p className="text-xs text-muted">ویرایش متن کامل، تصاویر و افزودن محصول جدید در نسخهٔ بعدی پنل اضافه می‌شود؛ تا آن زمان دادهٔ اولیه در src/data/catalog.ts است.</p>
    </div>
  );
}
