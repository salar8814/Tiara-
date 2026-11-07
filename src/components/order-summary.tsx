import { storeRules } from "@/data/rules";
import { orderStatus } from "@/lib/status";
import type { Order } from "@/lib/types";
import { Timeline } from "./timeline";
import { KeyValue, Money } from "./ui";

export const orderEventLabels: Record<string, string> = {
  ...Object.fromEntries(Object.entries(orderStatus).map(([k, v]) => [k, v.label])),
  payment_failed: "پرداخت ناموفق",
  refund_pending: "در انتظار بازگشت وجه",
  refunded: "وجه بازگردانده شد",
  pending_payment: "سفارش ثبت شد",
};

export function OrderSummary({ order }: { order: Order }) {
  const delivery = storeRules.deliveryMethods.find((d) => d.id === order.deliveryMethod);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-4 font-bold text-ink">اقلام سفارش</h2>
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.variantId} className="flex items-start justify-between gap-4 px-5 py-3.5 text-sm">
              <div>
                <p className="font-semibold text-ink">{i.name}</p>
                <p className="text-muted">{i.variantLabel} · {i.qty.toLocaleString("fa-IR")} عدد × <Money value={i.unitPrice} /></p>
              </div>
              <Money value={i.unitPrice * i.qty} className="font-semibold" />
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-5 py-3">
          <KeyValue
            rows={[
              ["جمع به قیمت مصرف‌کننده", <Money key="a" value={order.subtotalRetail} />],
              ["تخفیف کارکنان", <Money key="b" value={-order.employeeDiscount} className="text-success" />],
              ["هزینهٔ ارسال", order.shipping ? <Money key="c" value={order.shipping} /> : "رایگان"],
              [<strong key="t" className="text-ink">مبلغ کل</strong>, <Money key="d" value={order.total} className="text-base font-black" />],
            ]}
          />
        </div>
      </section>
      <div className="space-y-6">
        <section className="rounded-lg border border-line bg-surface p-5 text-sm">
          <h2 className="mb-2 font-bold text-ink">تحویل</h2>
          <p className="font-semibold text-ink-soft">{delivery?.name}</p>
          {order.address ? (
            <p className="mt-1 leading-7 text-muted">
              {order.address.recipient} · <span className="ltr">{order.address.mobile}</span>
              <br />
              {order.address.province}، {order.address.city}، {order.address.street}، پلاک {order.address.plaque}
              {order.address.unit && `، واحد ${order.address.unit}`}
              <br />
              کد پستی <span className="ltr">{order.address.postalCode}</span>
            </p>
          ) : (
            <p className="mt-1 text-muted">{delivery?.description}</p>
          )}
        </section>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 font-bold text-ink">تاریخچهٔ سفارش</h2>
          <Timeline events={order.events} labels={orderEventLabels} />
        </section>
      </div>
    </div>
  );
}
