import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderSummary } from "@/components/order-summary";
import { ReorderButton } from "@/components/reorder-buttons";
import { Badge, Container, LinkButton, Notice, PageHeader, Stepper } from "@/components/ui";
import { jDateTime } from "@/lib/format";
import { cancelOwnOrderAction } from "@/app/actions/shop";
import { Button } from "@/components/ui";
import { getOwnOrder } from "@/lib/services/customer";
import { requireUser } from "@/lib/session";
import { orderFlow, orderStatus, paymentStatusLabel } from "@/lib/status";

export const metadata: Metadata = { title: "جزئیات سفارش" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ cancelled?: string; error?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/account/orders/${code}`);
  const order = getOwnOrder(user, code);
  if (!order) notFound();
  const st = orderStatus[order.status];
  const steps = orderFlow.map((s) => ({ id: s, label: orderStatus[s].label }));

  return (
    <Container className="max-w-5xl">
      <PageHeader
        crumbs={[{ href: "/", label: "دنیای تیارا" }, { href: "/account?tab=orders", label: "سفارش‌های من" }, { label: order.code }]}
        title={<>سفارش <span className="ltr">{order.code}</span></>}
        lead={`ثبت در ${jDateTime(order.createdAt)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {order.paymentStatus !== "unpaid" && <Badge tone={paymentStatusLabel[order.paymentStatus].tone}>{paymentStatusLabel[order.paymentStatus].label}</Badge>}
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
        }
      />
      {sp.cancelled && <Notice tone="success" className="mb-4">سفارش لغو شد و موجودی آزاد شد.</Notice>}
      {sp.error && <Notice tone="danger" className="mb-4">این سفارش دیگر قابل لغو نیست.</Notice>}
      {order.paymentStatus === "refund_pending" && <Notice tone="warning" className="mb-4">این سفارش پس از پرداخت لغو شده است. واحد مالی مبلغ را بازمی‌گرداند و وضعیت اینجا به‌روز می‌شود.</Notice>}
      {order.paymentStatus === "refunded" && order.refundRef && <Notice tone="info" className="mb-4">مبلغ بازگردانده شد (مرجع <span className="ltr">{order.refundRef}</span>).</Notice>}
      {order.status === "cancelled" ? (
        <Notice tone="danger" className="mb-6">{st.hint}</Notice>
      ) : (
        <section className="mb-6 rounded-lg border border-line bg-surface p-5">
          <Stepper steps={steps} current={orderFlow.indexOf(order.status)} />
          <p className="mt-4 text-sm text-muted">{st.hint}</p>
        </section>
      )}
      <div className="mb-6 flex flex-wrap gap-2">
        {order.status === "pending_payment" && <LinkButton href={`/checkout/${order.code}`}>ادامهٔ پرداخت</LinkButton>}
        {order.status === "pending_payment" && (
          <form action={cancelOwnOrderAction}>
            <input type="hidden" name="code" value={order.code} />
            <Button variant="danger">لغو سفارش</Button>
          </form>
        )}
        {order.status !== "pending_payment" && <ReorderButton code={order.code} size="md" />}
      </div>
      <OrderSummary order={order} />
    </Container>
  );
}
