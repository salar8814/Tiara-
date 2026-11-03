"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./stores";
import { Button, Icon, cx } from "./ui";

export function QuickAdd({ variantId, max, disabled, label = "افزودن به سبد" }: { variantId: string; max: number; disabled?: boolean; label?: string }) {
  const cart = useCart();
  const inCart = cart.lines.find((l) => l.variantId === variantId)?.qty ?? 0;
  const atMax = inCart >= max;
  const [flash, setFlash] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="flex-1"
        disabled={disabled || atMax}
        onClick={() => {
          cart.add(variantId, 1, max);
          setFlash(true);
          setTimeout(() => setFlash(false), 1600);
        }}
      >
        {flash ? <><Icon name="check" size={16} /> افزوده شد</> : atMax ? "به سقف خرید رسیدید" : label}
      </Button>
      {cart.hydrated && inCart > 0 && (
        <Link href="/cart" className="grid h-9 min-w-9 place-items-center rounded-md border border-line-strong px-2 text-xs font-bold text-ink-soft hover:border-ink-soft" aria-label={`${inCart.toLocaleString("fa-IR")} عدد در سبد — مشاهدهٔ سبد`}>
          {inCart.toLocaleString("fa-IR")}×
        </Link>
      )}
    </div>
  );
}

export function QtyStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = "md",
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9" : "h-11";
  return (
    <div className={cx("inline-flex items-center rounded-md border border-line-strong bg-surface", h)} role="group" aria-label={label}>
      <button type="button" className="grid h-full w-10 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="افزایش">
        <Icon name="plus" size={16} />
      </button>
      <span className="num min-w-8 text-center text-sm font-bold" aria-live="polite">
        {value.toLocaleString("fa-IR")}
      </span>
      <button type="button" className="grid h-full w-10 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="کاهش">
        <Icon name="minus" size={16} />
      </button>
    </div>
  );
}
