import { Badge } from "@/components/ui";
import { faNum, jDate, toman } from "@/lib/format";
import { listUsers } from "@/lib/repo/users";
import { eligibilityLabel } from "@/lib/status";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "مشتریان" };

export default async function AdminCustomers() {
  await requireStaff("customers.view");
  const users = listUsers();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-ink">مشتریان</h1>
      <p className="text-sm text-muted">کاربران پس از اولین ورود ساخته می‌شوند. وضعیت کارمندی در هر ورود از منبع منابع انسانی به‌روزرسانی می‌شود.</p>
      {users.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">هنوز کاربری وارد نشده است.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start font-semibold">نام</th>
                <th className="px-4 py-2.5 text-start font-semibold">شماره</th>
                <th className="px-4 py-2.5 text-start font-semibold">وضعیت</th>
                <th className="px-4 py-2.5 text-start font-semibold">سازمان / واحد</th>
                <th className="px-4 py-2.5 text-start font-semibold">سفارش / استعلام</th>
                <th className="px-4 py-2.5 text-start font-semibold">پرداخت‌شده (شامل آزمایشی)</th>
                <th className="px-4 py-2.5 text-start font-semibold">عضویت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-semibold">{u.name ?? "—"}{u.employeeCode && <span className="block text-xs font-normal text-muted">کد پرسنلی {faNum(Number(u.employeeCode))}</span>}</td>
                  <td className="ltr px-4 py-3 text-end">{u.mobile}</td>
                  <td className="px-4 py-3"><Badge tone={eligibilityLabel[u.eligibility].tone}>{eligibilityLabel[u.eligibility].label}</Badge></td>
                  <td className="px-4 py-3">{[u.company, u.unit].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="num px-4 py-3">{faNum(u.orders)} / {faNum(u.rfqs)}</td>
                  <td className="num px-4 py-3">{toman(u.spent)}</td>
                  <td className="px-4 py-3">{jDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
