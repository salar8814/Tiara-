import type { Metadata } from "next";
import { AdminNav, type AdminNavItem } from "@/components/admin-nav";
import { Badge, Container } from "@/components/ui";
import { can, staffRoleLabels, type Permission } from "@/lib/authz";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: { default: "پنل مدیریت", template: "%s | پنل مدیریت تیارا" } };

const items: (AdminNavItem & { perm: Permission })[] = [
  { href: "/admin", label: "داشبورد", icon: "grid", perm: "staff.dashboard" },
  { href: "/admin/products", label: "محصولات، قیمت و موجودی", icon: "tag", perm: "inventory.adjust" },
  { href: "/admin/orders", label: "سفارش‌های فروشگاه", icon: "bag", perm: "orders.view" },
  { href: "/admin/requests", label: "استعلام‌ها و پیشنهاد قیمت", icon: "doc", perm: "rfq.manage" },
  { href: "/admin/meetings", label: "جلسه‌ها", icon: "calendar", perm: "meetings.manage" },
  { href: "/admin/customers", label: "مشتریان", icon: "user", perm: "customers.view" },
  { href: "/admin/audit", label: "گزارش تغییرات", icon: "clock", perm: "audit.view" },
  { href: "/admin/staff", label: "نقش‌های کارکنان", icon: "shield", perm: "staff.manage" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  // catalog editors see the products page too
  const visible = items.filter(
    (i) =>
      can(user, i.perm) ||
      (i.href === "/admin/products" && can(user, "catalog.edit")) ||
      (i.href === "/admin/requests" && (can(user, "corporate_orders.confirm") || can(user, "corporate_orders.fulfil"))),
  );
  return (
    <Container className="py-6">
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside>
          <p className="mb-1 px-3 text-xs font-bold text-muted">پنل مدیریت تیارا</p>
          <div className="mb-3 flex flex-wrap gap-1 px-3">
            {user.staffRoles.map((r) => <Badge key={r} tone="brand">{staffRoleLabels[r]}</Badge>)}
          </div>
          <AdminNav items={visible.map(({ href, label, icon }) => ({ href, label, icon }))} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
