import { staffRoleAction } from "@/app/actions/admin";
import { AdminFlash } from "@/components/admin-flash";
import { Badge, Button } from "@/components/ui";
import { staffRoleLabels } from "@/lib/authz";
import { jDate } from "@/lib/format";
import { listStaff } from "@/lib/repo/users";
import { requireStaff } from "@/lib/session";
import type { StaffRole } from "@/lib/types";

export const metadata = { title: "نقش‌های کارکنان" };

const roles: StaffRole[] = ["admin", "sales", "finance", "warehouse"];

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireStaff("staff.manage");
  const sp = await searchParams;
  const staff = listStaff();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">نقش‌های کارکنان</h1>
      <p className="text-sm text-muted">نقش‌ها با شمارهٔ همراه تعریف می‌شوند و پس از هر تغییر، نشست‌های فعال آن شخص بسته می‌شود تا مجوز جدید از ورود بعدی اعمال شود. هر تغییر در گزارش تغییرات ثبت می‌شود.</p>
      <AdminFlash sp={sp} />
      <form action={staffRoleAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-4">
        <input type="hidden" name="grant" value="1" />
        <label className="text-xs text-muted">شمارهٔ همراه<input name="mobile" required dir="ltr" placeholder="09xxxxxxxxx" className="mt-1 block h-10 w-44 rounded border border-line-strong px-2 text-sm" /></label>
        <label className="text-xs text-muted">نقش
          <select name="role" className="mt-1 block h-10 rounded border border-line-strong bg-surface px-2 text-sm">
            {roles.map((r) => <option key={r} value={r}>{staffRoleLabels[r]}</option>)}
          </select>
        </label>
        <Button>افزودن نقش</Button>
      </form>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {staff.map((s) => (
          <li key={`${s.mobile}-${s.role}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="font-semibold text-ink">{s.name ?? "—"}</span> <span className="ltr text-muted">{s.mobile}</span>
              <span className="block text-xs text-subtle">اعطا توسط {s.grantedBy} · {jDate(s.grantedAt)}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone="brand">{staffRoleLabels[s.role]}</Badge>
              {!(s.mobile === me.mobile && s.role === "admin") && (
                <form action={staffRoleAction}>
                  <input type="hidden" name="mobile" value={s.mobile} />
                  <input type="hidden" name="role" value={s.role} />
                  <input type="hidden" name="grant" value="0" />
                  <Button size="sm" variant="danger">حذف نقش</Button>
                </form>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
