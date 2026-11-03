"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reorderAction } from "@/app/actions/shop";
import { useCart, useInquiry, type InquiryLine } from "./stores";
import { Button, Icon, Notice } from "./ui";

export function ReorderButton({ code, size = "sm" }: { code: string; size?: "sm" | "md" }) {
  const cart = useCart();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant="secondary"
        size={size}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await reorderAction(code);
            if (res.lines.length === 0) {
              setMsg("اقلام این سفارش در حال حاضر موجود نیستند.");
              return;
            }
            cart.merge(res.lines);
            router.push(res.skipped.length ? `/cart?skipped=${res.skipped.length}` : "/cart");
          })
        }
      >
        <Icon name="refresh" size={16} /> {pending ? "در حال بررسی موجودی…" : "خرید دوباره"}
      </Button>
      {msg && <Notice tone="warning" className="mt-2">{msg}</Notice>}
    </div>
  );
}

export function RfqReorderButton({ lines }: { lines: InquiryLine[] }) {
  const inq = useInquiry();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={lines.length === 0}
      onClick={() => {
        inq.replace(lines);
        router.push("/corporate/inquiry");
      }}
    >
      <Icon name="refresh" size={16} /> استعلام دوباره با همین اقلام
    </Button>
  );
}
