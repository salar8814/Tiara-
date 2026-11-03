import type { Metadata } from "next";
import { AdminNav } from "@/components/admin-nav";
import { Container } from "@/components/ui";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: { default: "پنل مدیریت", template: "%s | پنل مدیریت تیارا" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <Container className="py-6">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <p className="mb-3 px-3 text-xs font-bold text-muted">پنل مدیریت تیارا</p>
          <AdminNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
