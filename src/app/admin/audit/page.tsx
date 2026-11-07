import { jDateTime } from "@/lib/format";
import { listAudit } from "@/lib/repo/audit";
import { listMovements } from "@/lib/repo/inventory";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "گزارش تغییرات" };

const show = (v: unknown) => (v === null || v === undefined ? "—" : JSON.stringify(v));

export default async function AuditPage() {
  await requireStaff("audit.view");
  const entries = listAudit({ limit: 200 });
  const moves = listMovements(undefined, 100);
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-black text-ink">گزارش تغییرات</h1>
        <p className="mt-1 text-sm text-muted">ثبت‌های این گزارش غیرقابل ویرایش و حذف‌اند (محافظت در سطح پایگاه داده). ۲۰۰ مورد آخر نمایش داده می‌شود.</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-canvas text-muted">
              <tr>
                <th className="px-3 py-2 text-start">زمان</th><th className="px-3 py-2 text-start">کاربر</th><th className="px-3 py-2 text-start">عملیات</th>
                <th className="px-3 py-2 text-start">موجودیت</th><th className="px-3 py-2 text-start">قبل</th><th className="px-3 py-2 text-start">بعد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">{jDateTime(e.createdAt)}</td>
                  <td className="ltr px-3 py-2 text-start">{e.actor}</td>
                  <td className="ltr px-3 py-2 text-start font-semibold">{e.action}</td>
                  <td className="ltr px-3 py-2 text-start">{e.entity}:{e.entityId.slice(0, 18)}</td>
                  <td className="ltr max-w-xs break-all px-3 py-2 text-start text-muted">{show(e.before)}</td>
                  <td className="ltr max-w-xs break-all px-3 py-2 text-start">{show(e.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && <p className="p-6 text-center text-sm text-muted">هنوز تغییری ثبت نشده است.</p>}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-bold text-ink">دفتر موجودی (۱۰۰ حرکت آخر)</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-canvas text-muted">
              <tr><th className="px-3 py-2 text-start">زمان</th><th className="px-3 py-2 text-start">گزینه</th><th className="px-3 py-2 text-start">تغییر</th><th className="px-3 py-2 text-start">موجودی پس از</th><th className="px-3 py-2 text-start">نوع</th><th className="px-3 py-2 text-start">مرجع / دلیل</th><th className="px-3 py-2 text-start">کاربر</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-3 py-2">{jDateTime(m.createdAt)}</td>
                  <td className="ltr px-3 py-2 text-start">{m.variantId}</td>
                  <td className={`ltr px-3 py-2 text-start font-bold ${m.delta < 0 ? "text-danger" : "text-success"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="ltr px-3 py-2 text-start">{m.stockAfter}</td>
                  <td className="ltr px-3 py-2 text-start">{m.reason}</td>
                  <td className="px-3 py-2">{m.ref ?? m.note ?? "—"}</td>
                  <td className="ltr px-3 py-2 text-start">{m.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
