"use client";

import { Button, Container, LinkButton } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="max-w-xl py-24 text-center">
      <h1 className="text-2xl font-black text-ink">مشکلی پیش آمد</h1>
      <p className="mt-2 text-muted">درخواست شما انجام نشد. اطلاعات ثبت‌شده‌تان حفظ شده است؛ دوباره تلاش کنید.</p>
      <div className="mt-8 flex justify-center gap-2">
        <Button onClick={reset}>تلاش دوباره</Button>
        <LinkButton href="/" variant="secondary">صفحهٔ اصلی</LinkButton>
      </div>
    </Container>
  );
}
