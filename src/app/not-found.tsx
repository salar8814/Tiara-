import { Container, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="max-w-xl py-24 text-center">
      <p className="num text-6xl font-black text-line-strong">۴۰۴</p>
      <h1 className="mt-4 text-2xl font-black text-ink">صفحه‌ای که دنبالش بودید پیدا نشد</h1>
      <p className="mt-2 text-muted">ممکن است نشانی اشتباه باشد یا محصول از کاتالوگ حذف شده باشد.</p>
      <div className="mt-8 flex justify-center gap-2">
        <LinkButton href="/">صفحهٔ اصلی</LinkButton>
        <LinkButton href="/shop" variant="secondary">فروشگاه کارکنان</LinkButton>
      </div>
    </Container>
  );
}
