import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { defaultAddressAction, deleteAddressAction } from "@/app/actions/shop";
import { NewAddress, ProfileForm } from "@/components/account-client";
import { EligibilityBanner } from "@/components/eligibility";
import { ReorderButton, RfqReorderButton } from "@/components/reorder-buttons";
import { Badge, Container, EmptyState, Icon, LinkButton, Money, Notice, PageHeader, cx } from "@/components/ui";
import { b2bRules } from "@/data/rules";
import { faNum, faTime, jDate, jDayLabel, toman } from "@/lib/format";
import { listMeetings } from "@/lib/repo/meetings";
import { listOrders } from "@/lib/repo/orders";
import { getProductById } from "@/lib/repo/products";
import { listCorporateOrders, listRfqs } from "@/lib/repo/rfqs";
import { listAddresses } from "@/lib/repo/users";
import { requireUser } from "@/lib/session";
import { corporateOrderStatus, eligibilityLabel, meetingStatus, orderStatus, rfqStatus } from "@/lib/status";
import type { Rfq } from "@/lib/types";

export const metadata: Metadata = { title: "حساب من" };

const tabs = [
  { id: "overview", label: "خلاصه" },
  { id: "orders", label: "سفارش‌های فروشگاه" },
  { id: "requests", label: "درخواست‌های سازمانی" },
  { id: "addresses", label: "نشانی‌ها" },
];

/** Map stored customization labels back to option ids so a past RFQ can be re-sent. */
function rfqToInquiry(rfq: Rfq) {
  return rfq.items
    .map((i) => {
      const p = getProductById(i.productId);
      if (!p?.b2b || !p.active) return null;
      return {
        productId: p.id,
        qty: i.qty,
        customization: p.b2b.customization.filter((c) => i.customization.includes(c.label)).map((c) => c.id),
        note: i.note,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string; denied?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const tab = tabs.some((t) => t.id === sp.tab) ? sp.tab! : "overview";
  const orders = listOrders(user.id);
  const rfqs = listRfqs({ userId: user.id });
  const corpOrders = listCorporateOrders(user.id);
  const meetings = listMeetings({ userId: user.id });
  const addresses = listAddresses(user.id);
  const el = eligibilityLabel[user.eligibility];

  return (
    <Container>
      <PageHeader
        crumbs={[{ href: "/", label: "دنیای تیارا" }, { label: "حساب من" }]}
        title={user.name ? `سلام، ${user.name}` : "حساب من"}
        lead={<span className="flex flex-wrap items-center gap-2"><span className="ltr">{user.mobile}</span><Badge tone={el.tone}>{el.label}</Badge>{user.role === "admin" && <Badge tone="brand">مدیر سامانه</Badge>}</span>}
        action={
          <form action={logoutAction}>
            <button className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink"><Icon name="logout" size={16} /> خروج</button>
          </form>
        }
      />
      {sp.denied === "admin" && <Notice tone="danger" className="mb-4">دسترسی به پنل مدیریت فقط برای نقش مدیر فعال است.</Notice>}

      <nav aria-label="بخش‌های حساب" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1">
          {tabs.map((t) => (
            <li key={t.id}>
              <Link
                href={`/account?tab=${t.id}`}
                aria-current={tab === t.id ? "page" : undefined}
                className={cx("block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold", tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <EligibilityBanner user={user} />
            <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
              <h2 className="mb-5 font-bold text-ink">اطلاعات حساب</h2>
              <ProfileForm user={user} />
            </section>
          </div>
          <div className="space-y-4">
            <StatCard icon="bag" label="سفارش‌های فروشگاه" value={faNum(orders.length)} href="/account?tab=orders" />
            <StatCard icon="list" label="درخواست‌های سازمانی" value={faNum(rfqs.length)} href="/account?tab=requests" />
            <StatCard icon="calendar" label="جلسه‌ها" value={faNum(meetings.length)} href="/account?tab=requests" />
          </div>
        </div>
      )}

      {tab === "orders" && (
        orders.length === 0 ? (
          <EmptyState title="هنوز سفارشی ثبت نکرده‌اید" icon={<Icon name="bag" />} action={<LinkButton href="/shop">فروشگاه کارکنان</LinkButton>} />
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/account/orders/${o.code}`} className="ltr font-bold text-ink hover:underline">{o.code}</Link>
                    <p className="text-xs text-muted">{jDate(o.createdAt)} · {faNum(o.items.reduce((s, i) => s + i.qty, 0))} کالا</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.paymentStatus === "paid_sandbox" && <Badge tone="warning">پرداخت آزمایشی</Badge>}
                    <Badge tone={orderStatus[o.status].tone}>{orderStatus[o.status].label}</Badge>
                  </div>
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-ink-soft">{o.items.map((i) => i.name).join("، ")}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Money value={o.total} className="font-bold" />
                  <div className="flex flex-wrap gap-2">
                    {o.status === "pending_payment" && <LinkButton href={`/checkout/${o.code}`} size="sm">ادامهٔ پرداخت</LinkButton>}
                    <LinkButton href={`/account/orders/${o.code}`} variant="secondary" size="sm">جزئیات و پیگیری</LinkButton>
                    {o.status !== "pending_payment" && <ReorderButton code={o.code} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "requests" && (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-ink">استعلام‌ها</h2>
              <LinkButton href="/corporate" size="sm" variant="secondary">استعلام جدید</LinkButton>
            </div>
            {rfqs.length === 0 ? (
              <EmptyState title="درخواست سازمانی ثبت نشده است" icon={<Icon name="list" />}>
                استعلام‌هایی که با شمارهٔ <span className="ltr">{user.mobile}</span> ثبت شوند اینجا نمایش داده می‌شوند.
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {rfqs.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line bg-surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link href={`/corporate/requests/${r.code}`} className="ltr font-bold text-ink hover:underline">{r.code}</Link>
                        <p className="text-xs text-muted">{r.company} · {jDate(r.createdAt)} · مهلت تحویل {jDate(r.deadline)}</p>
                      </div>
                      <Badge tone={rfqStatus[r.status].tone}>{rfqStatus[r.status].label}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink-soft">{r.items.map((i) => `${i.name} (${faNum(i.qty)} ${i.unitLabel})`).join("، ")}</p>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                      <LinkButton href={`/corporate/requests/${r.code}`} size="sm">{r.status === "quoted" ? "بررسی پیشنهاد قیمت" : "پیگیری"}</LinkButton>
                      {["converted", "declined", "closed"].includes(r.status) && <RfqReorderButton lines={rfqToInquiry(r)} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {corpOrders.length > 0 && (
            <section>
              <h2 className="mb-3 font-bold text-ink">سفارش‌های سازمانی قطعی</h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {corpOrders.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                    <span>
                      <span className="ltr block font-bold text-ink">{c.code}</span>
                      <span className="text-xs text-muted">استعلام <span className="ltr">{c.rfqCode}</span> · {toman(c.total)}</span>
                    </span>
                    <Badge tone={corporateOrderStatus[c.status].tone}>{corporateOrderStatus[c.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-bold text-ink">جلسه‌ها</h2>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted">جلسه‌ای ثبت نشده است. <Link href="/corporate/meeting" className="font-semibold text-clay-700 hover:underline">رزرو جلسه</Link></p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {meetings.map((m) => {
                  const d = jDayLabel(m.date);
                  return (
                    <li key={m.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
                      <p className="font-bold text-ink">{d.weekday} {d.day} · ساعت {faTime(m.time)}</p>
                      <p className="text-xs text-muted">{b2bRules.meeting.types.find((t) => t.id === m.type)?.name} · {m.company}</p>
                      <Badge tone={meetingStatus[m.status].tone} className="mt-2">{meetingStatus[m.status].label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "addresses" && (
        <div className="space-y-4">
          {addresses.length === 0 && <p className="text-sm text-muted">نشانی ذخیره‌شده‌ای ندارید.</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-lg border border-line bg-surface p-5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-ink">{a.label}</p>
                  {a.isDefault && <Badge>پیش‌فرض</Badge>}
                </div>
                <p className="mt-2 leading-7 text-ink-soft">
                  {a.province}، {a.city}، {a.street}، پلاک {a.plaque}{a.unit && `، واحد ${a.unit}`}
                  <br />
                  کد پستی <span className="ltr">{a.postalCode}</span> · {a.recipient} · <span className="ltr">{a.mobile}</span>
                </p>
                <div className="mt-3 flex gap-3 border-t border-line pt-3">
                  {!a.isDefault && (
                    <form action={defaultAddressAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="font-semibold text-indigo-700 hover:underline">پیش‌فرض شود</button>
                    </form>
                  )}
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="font-semibold text-muted hover:text-danger">حذف</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <NewAddress defaults={{ recipient: user.name, mobile: user.mobile }} />
        </div>
      )}
    </Container>
  );
}

function StatCard({ icon, label, value, href }: { icon: string; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
      <span className="grid size-11 place-items-center rounded-full bg-canvas text-ink-soft"><Icon name={icon} /></span>
      <span className="flex-1">
        <span className="block text-sm text-muted">{label}</span>
        <span className="num text-xl font-black text-ink">{value}</span>
      </span>
      <Icon name="chevron" size={18} className="text-subtle" />
    </Link>
  );
}
