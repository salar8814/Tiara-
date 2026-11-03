"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart, useInquiry } from "./stores";
import { Icon, cx } from "./ui";

export function NavLinks({ items }: { items: { href: string; label: string; match: string }[] }) {
  const path = usePathname();
  // most specific match wins (e.g. /corporate/track over /corporate)
  const best = items
    .filter((it) => path === it.match || path.startsWith(`${it.match}/`))
    .sort((a, b) => b.match.length - a.match.length)[0];
  return (
    <>
      {items.map((it) => {
        const active = best?.href === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {it.label}
            {active && <span className="absolute inset-x-3 -bottom-[13px] hidden h-0.5 rounded-full bg-ink md:block" />}
          </Link>
        );
      })}
    </>
  );
}

function CountBubble({ n, tone }: { n: number; tone: "indigo" | "clay" }) {
  if (n <= 0) return null;
  return (
    <span
      className={cx(
        "absolute -top-1 -left-1 grid min-w-5 place-items-center rounded-full px-1 text-[0.6875rem] font-bold leading-5 text-white ring-2 ring-surface",
        tone === "indigo" ? "bg-indigo-600" : "bg-clay-600",
      )}
    >
      {n.toLocaleString("fa-IR")}
    </span>
  );
}

export function BasketLinks() {
  const cart = useCart();
  const inquiry = useInquiry();
  return (
    <>
      <Link
        href="/corporate/inquiry"
        className="relative grid size-10 place-items-center rounded-md text-ink-soft hover:bg-sunken"
        aria-label={`فهرست استعلام سازمانی${inquiry.hydrated && inquiry.count ? `، ${inquiry.count.toLocaleString("fa-IR")} قلم` : ""}`}
        title="فهرست استعلام سازمانی"
      >
        <Icon name="list" />
        {inquiry.hydrated && <CountBubble n={inquiry.count} tone="clay" />}
      </Link>
      <Link
        href="/cart"
        className="relative grid size-10 place-items-center rounded-md text-ink-soft hover:bg-sunken"
        aria-label={`سبد خرید${cart.hydrated && cart.count ? `، ${cart.count.toLocaleString("fa-IR")} کالا` : ""}`}
        title="سبد خرید"
      >
        <Icon name="bag" />
        {cart.hydrated && <CountBubble n={cart.count} tone="indigo" />}
      </Link>
    </>
  );
}
