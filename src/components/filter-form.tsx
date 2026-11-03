"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition, type ReactNode } from "react";

/**
 * GET form that works without JavaScript and, with JS, applies filters
 * instantly by replacing the URL (server re-renders the filtered list).
 */
export function FilterForm({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const apply = () => {
    const form = ref.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v !== "") params.set(k, v);
    start(() => router.replace(`${path}${params.size ? `?${params}` : ""}`, { scroll: false }));
  };

  return (
    <form
      ref={ref}
      method="get"
      action={path}
      className={className}
      data-pending={pending || undefined}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        clearTimeout(timer.current);
        timer.current = setTimeout(apply, t.type === "search" || t.type === "text" ? 350 : 0);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      {children}
    </form>
  );
}
