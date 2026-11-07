import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { EligibilityBanner } from "@/components/eligibility";
import { Container, LinkButton, PageHeader, Stepper } from "@/components/ui";
import { paymentMode } from "@/lib/config";
import { payrollEnabled } from "@/lib/integrations";
import { canUseEmployeePrice } from "@/lib/pricing";
import { listAddresses, refreshEligibility } from "@/lib/repo/users";
import { requireUser } from "@/lib/session";
import { b2cSnapshot } from "@/lib/snapshot";

export const metadata: Metadata = { title: "تکمیل سفارش" };

const steps = [
  { id: "cart", label: "سبد خرید" },
  { id: "details", label: "تحویل و پرداخت" },
  { id: "pay", label: "پرداخت" },
  { id: "done", label: "پیگیری سفارش" },
];

export default async function CheckoutPage() {
  // Eligibility is re-read from HR here and again when the order is placed.
  const user = refreshEligibility(await requireUser("/checkout"));
  const crumbs = [{ href: "/", label: "دنیای تیارا" }, { href: "/cart", label: "سبد خرید" }, { label: "تکمیل سفارش" }];

  if (!canUseEmployeePrice(user.eligibility)) {
    return (
      <Container className="max-w-3xl">
        <PageHeader crumbs={crumbs} title="تکمیل سفارش" />
        <EligibilityBanner user={user} />
        <div className="mt-6 flex gap-2">
          <LinkButton href="/cart" variant="secondary">بازگشت به سبد</LinkButton>
          <LinkButton href="/corporate">کاتالوگ سازمانی</LinkButton>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader crumbs={crumbs} title="تکمیل سفارش" />
      <div className="mb-8 rounded-lg border border-line bg-surface px-5 py-4">
        <Stepper steps={steps} current={1} />
      </div>
      <CheckoutForm
        catalog={b2cSnapshot()}
        addresses={listAddresses(user.id)}
        paymentMode={paymentMode()}
        payrollEnabled={payrollEnabled()}
        user={{ name: user.name, mobile: user.mobile }}
      />
    </Container>
  );
}
