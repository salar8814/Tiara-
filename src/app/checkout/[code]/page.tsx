import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sandboxPayAction } from "@/app/actions/shop";
import { OrderSummary } from "@/components/order-summary";
import { Badge, Button, Container, Icon, LinkButton, Notice, PageHeader, Stepper } from "@/components/ui";
import { jDateTime, toman } from "@/lib/format";
import { paymentMode } from "@/lib/config";
import { PAYMENT_WINDOW_MIN } from "@/lib/repo/orders";
import { getOwnOrder } from "@/lib/services/customer";
import { requireUser } from "@/lib/session";
import { orderStatus } from "@/lib/status";

export const metadata: Metadata = { title: "پرداخت سفارش" };

type P = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function PaymentPage({ params, searchParams }: P) {
  const { code } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/checkout/${code}`);
  const order = getOwnOrder(user, code);
  if (!order) notFound();

  const mode = paymentMode();
  const awaiting = order.status === "pending_payment";
  const deadline = new Date(new Date(order.createdAt).getTime() + PAYMENT_WINDOW_MIN * 60_000).toISOString();
  const steps = [
    { id: "cart", label: "سبد خرید" },
    { id: "details", label: "تحویل و پرداخت" },
    { id: "pay", label: "پرداخت" },
    { id: "done", label: "پیگیری سفارش" },
  ];
  const st = orderStatus[order.status];

  return (
    <Container className="max-w-4xl">
      <PageHeader
        crumbs={[{ href: "/", label: "دنیای تیارا" }, { href: "/account?tab=orders", label: "سفارش‌های من" }, { label: `سفارش ${order.code}` }]}
        title={awaiting ? "پرداخت سفارش" : order.status === "cancelled" ? "سفارش لغو شد" : "سفارش شما ثبت و پرداخت شد"}
        lead={<>کد سفارش <span className="ltr font-bold text-ink">{order.code}</span> · ثبت در {jDateTime(order.createdAt)}</>}
        action={<Badge tone={st.tone}>{st.label}</Badge>}
      />
      <div className="mb-6 rounded-lg border border-line bg-surface px-5 py-4">
        <Stepper steps={steps} current={awaiting ? 2 : 3} />
      </div>

      {sp.result === "failure" && <Notice tone="danger" className="mb-4">پرداخت ناموفق بود و مبلغی کسر نشد. می‌توانید دوباره تلاش کنید.</Notice>}
      {sp.error === "gateway" && <Notice tone="danger" className="mb-4">درگاه پرداخت در دسترس نیست.</Notice>}
      {sp.error === "state" && <Notice tone="danger" className="mb-4">وضعیت این سفارش برای پرداخت مناسب نیست.</Notice>}

      {awaiting && (
        <section className="mb-6 rounded-lg border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-ink">مبلغ قابل پرداخت: <span className="num">{toman(order.total)}</span></h2>
              <p className="mt-1 text-sm text-muted">
                <Icon name="clock" size={16} className="me-1 inline" />
                موجودی تا {jDateTime(deadline)} رزرو است؛ پس از آن سفارش پرداخت‌نشده خودکار لغو می‌شود.
              </p>
            </div>
          </div>

          {order.paymentMethod === "gateway" && mode === "sandbox" && (
            <div className="mt-5 rounded-md border border-dashed border-warning/50 bg-warning-soft/50 p-4">
              <p className="text-sm font-bold text-warning">شبیه‌ساز درگاه پرداخت — محیط آزمایشی</p>
              <p className="mt-1 text-sm leading-7 text-ink-soft">
                درگاه واقعی شاپرک هنوز متصل نیست. این دکمه‌ها فقط نتیجهٔ بازگشت از درگاه را شبیه‌سازی می‌کنند؛ هیچ مبلغی جابه‌جا نمی‌شود و سفارش برچسب «پرداخت آزمایشی» می‌گیرد.
              </p>
              <form action={sandboxPayAction} className="mt-4 flex flex-wrap gap-2">
                <input type="hidden" name="code" value={order.code} />
                <Button name="outcome" value="success" size="md">شبیه‌سازی پرداخت موفق</Button>
                <Button name="outcome" value="failure" variant="secondary">شبیه‌سازی پرداخت ناموفق</Button>
              </form>
            </div>
          )}
          {order.paymentMethod === "gateway" && mode === "disabled" && (
            <Notice tone="warning" className="mt-5" title="درگاه پرداخت متصل نیست.">
              سفارش شما ثبت شده و در انتظار پرداخت است. پس از اتصال درگاه، پرداخت از همین صفحه انجام می‌شود. در صورت نیاز با پشتیبانی تماس بگیرید تا پرداخت از طریق واحد مالی تطبیق داده شود.
            </Notice>
          )}
        </section>
      )}

      {order.paymentStatus === "paid_sandbox" && (
        <Notice tone="prototype" className="mb-6">این سفارش با شبیه‌ساز پرداخت تأیید شده و تراکنش مالی واقعی ندارد.</Notice>
      )}
      {!awaiting && order.status !== "cancelled" && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-success/25 bg-success-soft p-5">
          <span className="grid size-11 place-items-center rounded-full bg-surface text-success"><Icon name="check" /></span>
          <div className="flex-1 text-sm text-success">
            <p className="font-bold">پرداخت تأیید شد{order.paymentRef ? <> · مرجع <span className="ltr">{order.paymentRef}</span></> : null}</p>
            <p>وضعیت سفارش را از «سفارش‌های من» پیگیری کنید.</p>
          </div>
          <LinkButton href={`/account/orders/${order.code}`} variant="secondary">پیگیری سفارش</LinkButton>
        </div>
      )}

      <OrderSummary order={order} />
    </Container>
  );
}
