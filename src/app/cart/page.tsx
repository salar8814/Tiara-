import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { EligibilityBanner } from "@/components/eligibility";
import { Container, PageHeader } from "@/components/ui";
import { canUseEmployeePrice } from "@/lib/pricing";
import { currentUser } from "@/lib/session";
import { b2cSnapshot } from "@/lib/snapshot";

export const metadata: Metadata = { title: "سبد خرید" };

export default async function CartPage() {
  const user = await currentUser();
  const eligible = canUseEmployeePrice(user?.eligibility);
  return (
    <Container>
      <PageHeader crumbs={[{ href: "/", label: "دنیای تیارا" }, { href: "/shop", label: "فروشگاه کارکنان" }, { label: "سبد خرید" }]} title="سبد خرید" />
      {!eligible && (
        <div className="mb-6">
          <EligibilityBanner user={user} next="/cart" />
        </div>
      )}
      {/* Guests may continue: checkout asks them to sign in first. */}
      <CartView catalog={b2cSnapshot()} eligible={eligible} canCheckout={!user || eligible} />
    </Container>
  );
}
