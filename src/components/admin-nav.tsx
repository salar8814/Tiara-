"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, cx } from "./ui";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
}

/** Display only — every admin page and action re-checks permissions on the server. */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="منوی مدیریت" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((it) => {
          const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cx("flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold", active ? "bg-ink text-white" : "text-ink-soft hover:bg-sunken")}
              >
                <Icon name={it.icon} size={18} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
