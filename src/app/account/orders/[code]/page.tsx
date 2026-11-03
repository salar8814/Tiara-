import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderSummary } from "@/components/order-summary";
import { ReorderButton } from "@/components/reorder-buttons";
import { Badge, Container, LinkButton, Notice, PageHeader, Stepper } from "@/components/ui";
import { jDateTime } from "@/lib/format";
import { getOrderByCode } from "@/lib/repo/orders";
import { requireUser } from "@/lib/session";
import { orderFlow, orderStatus } from "@/lib/status";

export const metadata: Metadata = { title: "جزئیات سفارش" };

export default async function OrderDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser(`/account/orders/${code}`);
  const order = getOrderByCode(code);
  if (!order || order.userId !== user.id) notFound();
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
            {order.paymentStatus === "paid_sandbox" && <Badge tone="warning">پرداخت آزمایشی</Badge>}
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
        }
      />
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
        {order.status !== "pending_payment" && <ReorderButton code={order.code} size="md" />}
      </div>
      <OrderSummary order={order} />
    </Container>
  );
}
