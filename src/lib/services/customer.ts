import "server-only";
import { canDecideRfq } from "../access";
import { createOrder, getOrderByCode, type CheckoutInput } from "../repo/orders";
import { decideQuotation, getRfqByCode } from "../repo/rfqs";
import { refreshEligibility } from "../repo/users";
import type { Order, User } from "../types";

// Customer-facing operations that need ownership checks. Pages and actions use
// these instead of re-implementing "is this mine?" inline.

/** Returns the order only if it belongs to `user` (otherwise null → 404, no existence leak). */
export function getOwnOrder(user: User, code: string): Order | null {
  const o = getOrderByCode(code);
  return o && o.userId === user.id ? o : null;
}

/** Checkout always re-reads HR eligibility, so pricing reflects current employment. */
export function placeOrder(user: User, input: Omit<CheckoutInput, "user">): Order {
  const fresh = refreshEligibility(user);
  return createOrder({ ...input, user: fresh });
}

export class NotAllowedError extends Error {}

/** Only the OTP-verified owner of the RFQ may approve or decline its quotation. */
export function decideOwnQuotation(user: User | null, rfqCode: string, quotationId: string, decision: "approved" | "declined", note: string | null) {
  const rfq = getRfqByCode(rfqCode);
  if (!rfq || !canDecideRfq(rfq, user)) throw new NotAllowedError("only the verified requester can decide");
  decideQuotation(quotationId, decision, `customer:${user!.mobile}`, note);
}
