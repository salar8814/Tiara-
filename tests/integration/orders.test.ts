import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { reconcile } from "@/lib/repo/inventory";
import {
  CheckoutError,
  OrderStateError,
  createOrder,
  customerCancelOrder,
  expireOrder,
  expireStaleOrders,
  getOrderById,
  recordManualPayment,
  recordRefund,
  settleSandboxPayment,
  transitionOrder,
} from "@/lib/repo/orders";
import { getProductById, updateProduct } from "@/lib/repo/products";
import { addAddress, upsertUserOnLogin } from "@/lib/repo/users";
import { placeOrder } from "@/lib/services/customer";
import type { User } from "@/lib/types";
import { ageOrder, count, setStockViaLedger, stockOf } from "../helpers";

const V = "v-viana-noir-50"; // cap 3 per order
let employee: User;
const order = (lines = [{ variantId: V, qty: 1 }], extra: Partial<Parameters<typeof createOrder>[0]> = {}) =>
  createOrder({ user: employee, lines, deliveryMethod: "workplace", address: null, paymentMethod: "gateway", ...extra });

beforeEach(() => {
  employee = upsertUserOnLogin("09121111111");
  setStockViaLedger(V, 10);
});

describe("checkout pricing and validation (server-authoritative)", () => {
  it("charges employee price from the database, not from the client", () => {
    const o = order([{ variantId: V, qty: 2 }]);
    expect(o.items[0].unitPrice).toBe(1_295_000);
    expect(o.items[0].unitRetail).toBe(1_850_000);
    expect(o.total).toBe(2 * 1_295_000); // workplace delivery: free
    expect(o.employeeDiscount).toBe(2 * 555_000);
  });

  it("rejects non-eligible users", () => {
    for (const m of ["09123333333", "09124444444", "09129990000"]) {
      const u = upsertUserOnLogin(m);
      expect(() => createOrder({ user: u, lines: [{ variantId: V, qty: 1 }], deliveryMethod: "workplace", address: null, paymentMethod: "gateway" })).toThrow(CheckoutError);
    }
  });

  it("re-checks HR eligibility at checkout (leaver with an active session)", () => {
    const u = upsertUserOnLogin("09122222222");
    db().prepare("UPDATE hr_directory SET status = 'inactive' WHERE mobile = ?").run("09122222222");
    try {
      expect(() => placeOrder(u, { lines: [{ variantId: V, qty: 1 }], deliveryMethod: "workplace", address: null, paymentMethod: "gateway" })).toThrow(CheckoutError);
    } finally {
      db().prepare("UPDATE hr_directory SET status = 'active' WHERE mobile = ?").run("09122222222");
    }
  });

  it("B-02: per-order cap applies to the variant even across duplicate lines", () => {
    expect(() => order([{ variantId: V, qty: 3 }, { variantId: V, qty: 3 }])).toThrow(CheckoutError);
    expect(stockOf(V)).toBe(10);
  });

  it("B-04: deactivated products cannot be bought", () => {
    const p = getProductById("p-viana-noir")!;
    updateProduct(p.id, { active: false, summary: p.summary, b2b: p.b2b });
    try {
      expect(() => order()).toThrow(CheckoutError);
    } finally {
      updateProduct(p.id, { active: true, summary: p.summary, b2b: p.b2b });
    }
  });

  it("B2B-only bundles have no purchasable variants; unknown variants are refused", () => {
    expect(() => order([{ variantId: "does-not-exist", qty: 1 }])).toThrow(CheckoutError);
  });

  it("courier delivery requires the user's own address", () => {
    expect(() => order([{ variantId: V, qty: 1 }], { deliveryMethod: "courier" })).toThrow(CheckoutError);
    const other = upsertUserOnLogin("09122222222");
    const foreign = addAddress(other.id, { label: "x", recipient: "x y", mobile: "09122222222", province: "تهران", city: "تهران", street: "خیابان آزمون پلاک", plaque: "1", unit: "", postalCode: "1433875911" }, false);
    expect(() => order([{ variantId: V, qty: 1 }], { deliveryMethod: "courier", address: foreign })).toThrow(CheckoutError);
  });

  it("rejects insufficient stock without reserving anything", () => {
    setStockViaLedger(V, 1);
    expect(() => order([{ variantId: V, qty: 2 }])).toThrow(CheckoutError);
    expect(stockOf(V)).toBe(1);
  });
});

describe("inventory reservation and release", () => {
  it("reserves on order and keeps the ledger reconciled", () => {
    order([{ variantId: V, qty: 3 }]);
    expect(stockOf(V)).toBe(7);
    expect(reconcile()).toEqual([]);
  });

  it("last unit: second buyer is refused, stock never negative", () => {
    setStockViaLedger(V, 1);
    order();
    expect(() => order()).toThrow(CheckoutError);
    expect(stockOf(V)).toBe(0);
  });

  it("B-01: expiring the same order twice (stale candidate list) releases stock once", () => {
    const o = order([{ variantId: V, qty: 2 }]);
    ageOrder(o.id, 31);
    expect(expireOrder(o.id)).toBe(true);
    expect(expireOrder(o.id)).toBe(false);
    expect(expireStaleOrders()).toBe(0);
    expect(stockOf(V)).toBe(10);
    expect(count("SELECT COUNT(*) c FROM inventory_movements WHERE ref = ? AND reason = 'release'", o.code)).toBe(1);
  });

  it("orders inside the payment window are not expired", () => {
    const o = order();
    ageOrder(o.id, 29);
    expect(expireOrder(o.id)).toBe(false);
    expect(getOrderById(o.id)!.status).toBe("pending_payment");
  });

  it("expiry vs cancellation race: whichever runs second does nothing", () => {
    const o = order([{ variantId: V, qty: 2 }]);
    ageOrder(o.id, 40);
    expect(customerCancelOrder(employee, o.code)).toBe(true);
    expect(expireOrder(o.id)).toBe(false);
    expect(stockOf(V)).toBe(10);
  });

  it("a paid order is never expired", () => {
    const o = order();
    settleSandboxPayment(o.id, "success");
    ageOrder(o.id, 120);
    expect(expireStaleOrders()).toBe(0);
    expect(getOrderById(o.id)!.status).toBe("paid");
    expect(stockOf(V)).toBe(9);
  });
});

describe("duplicate submissions", () => {
  it("B-07: the same idempotency key returns the same order and reserves once", () => {
    const a = order([{ variantId: V, qty: 2 }], { idempotencyKey: "checkout-attempt-0001" });
    const b = order([{ variantId: V, qty: 2 }], { idempotencyKey: "checkout-attempt-0001" });
    expect(b.id).toBe(a.id);
    expect(stockOf(V)).toBe(8);
  });

  it("keys are scoped per user", () => {
    const other = upsertUserOnLogin("09122222222");
    const a = order([{ variantId: V, qty: 1 }], { idempotencyKey: "shared-key-0001" });
    const b = createOrder({ user: other, lines: [{ variantId: V, qty: 1 }], deliveryMethod: "workplace", address: null, paymentMethod: "gateway", idempotencyKey: "shared-key-0001" });
    expect(b.id).not.toBe(a.id);
    expect(b.userId).toBe(other.id);
  });
});

describe("payment lifecycle", () => {
  it("failure keeps the order payable, success marks it paid_sandbox (never 'paid')", () => {
    const o = order();
    settleSandboxPayment(o.id, "failure");
    expect(getOrderById(o.id)).toMatchObject({ status: "pending_payment", paymentStatus: "failed" });
    settleSandboxPayment(o.id, "success");
    expect(getOrderById(o.id)).toMatchObject({ status: "paid", paymentStatus: "paid_sandbox" });
  });

  it("a second payment callback for the same order is refused", () => {
    const o = order();
    settleSandboxPayment(o.id, "success");
    expect(() => settleSandboxPayment(o.id, "success")).toThrow(OrderStateError);
    expect(() => recordManualPayment(o.id, "BANK-0001", "staff:x")).toThrow(OrderStateError);
  });

  it("payment after the window expired is refused and stock is released", () => {
    const o = order();
    ageOrder(o.id, 31);
    expect(() => settleSandboxPayment(o.id, "success")).toThrow(OrderStateError);
    expect(getOrderById(o.id)!.status).toBe("cancelled");
    expect(stockOf(V)).toBe(10);
  });

  it("B-03: generic transition cannot mark an order paid", () => {
    const o = order();
    expect(() => transitionOrder(o.id, "paid", "staff:x")).toThrow(OrderStateError);
    expect(getOrderById(o.id)!.paymentStatus).toBe("unpaid");
  });

  it("one bank reference cannot settle two orders", () => {
    const a = order();
    const b = order();
    recordManualPayment(a.id, "BANK-777777", "staff:fin");
    expect(() => recordManualPayment(b.id, "BANK-777777", "staff:fin")).toThrow(/already used/);
    expect(getOrderById(b.id)!.status).toBe("pending_payment");
  });

  it("invalid fulfilment jumps are refused", () => {
    const o = order();
    expect(() => transitionOrder(o.id, "shipped", "staff:x")).toThrow(OrderStateError);
  });
});

describe("cancellation, stock restoration and refunds", () => {
  it("cancelling an unpaid order restores stock once", () => {
    const o = order([{ variantId: V, qty: 3 }]);
    transitionOrder(o.id, "cancelled", "staff:x");
    expect(stockOf(V)).toBe(10);
    expect(() => transitionOrder(o.id, "cancelled", "staff:x")).toThrow(OrderStateError);
    expect(stockOf(V)).toBe(10);
  });

  it("B-05: cancelling a really-paid order creates a refund obligation; finance records it once", () => {
    const o = order([{ variantId: V, qty: 1 }]);
    recordManualPayment(o.id, "BANK-123456", "staff:fin");
    transitionOrder(o.id, "processing", "staff:wh");
    transitionOrder(o.id, "cancelled", "staff:fin", "customer request");
    expect(getOrderById(o.id)).toMatchObject({ status: "cancelled", paymentStatus: "refund_pending" });
    expect(stockOf(V)).toBe(10);
    recordRefund(o.id, "REFUND-123456", "staff:fin");
    expect(getOrderById(o.id)).toMatchObject({ paymentStatus: "refunded", refundRef: "REFUND-123456" });
    expect(() => recordRefund(o.id, "REFUND-999999", "staff:fin")).toThrow(OrderStateError);
  });

  it("sandbox-paid cancellation is marked refunded with no funds moved", () => {
    const o = order();
    settleSandboxPayment(o.id, "success");
    transitionOrder(o.id, "cancelled", "staff:fin");
    expect(getOrderById(o.id)).toMatchObject({ paymentStatus: "refunded", refundRef: "SANDBOX-NO-FUNDS" });
  });

  it("shipped orders cannot be cancelled", () => {
    const o = order();
    recordManualPayment(o.id, "BANK-SHIP-01", "staff:fin");
    transitionOrder(o.id, "processing", "staff:wh");
    transitionOrder(o.id, "shipped", "staff:wh");
    expect(() => transitionOrder(o.id, "cancelled", "staff:fin")).toThrow(OrderStateError);
  });

  it("customers can cancel only their own unpaid orders", () => {
    const mine = order();
    const other = upsertUserOnLogin("09122222222");
    expect(customerCancelOrder(other, mine.code)).toBe(false);
    expect(getOrderById(mine.id)!.status).toBe("pending_payment");
    settleSandboxPayment(mine.id, "success");
    expect(customerCancelOrder(employee, mine.code)).toBe(false);
  });

  it("the inventory ledger reconciles after all of the above", () => {
    expect(reconcile()).toEqual([]);
  });
});
