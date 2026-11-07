// BASELINE REPRODUCTION SUITE (written against commit d10c915, before remediation).
// Each test asserts the *required* business behaviour. Against the baseline code
// these fail; the failures are the evidence recorded in docs/BASELINE_AUDIT.md.
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrder, expireStaleOrders, getOrderById, transitionOrder } from "@/lib/repo/orders";
import { updateProduct, updateVariant, getProductById } from "@/lib/repo/products";
import { createRfq, decideQuotation, issueQuotation, transitionRfq } from "@/lib/repo/rfqs";
import { upsertUserOnLogin } from "@/lib/repo/users";
import { safeNext } from "@/lib/session";
import { ageOrder, setStock, stockOf } from "../helpers";

const V = "v-viana-noir-50";
const employee = () => upsertUserOnLogin("09121111111");
const order = (lines = [{ variantId: V, qty: 1 }]) =>
  createOrder({ user: employee(), lines, deliveryMethod: "workplace", address: null, paymentMethod: "gateway" });

beforeEach(() => setStock(V, 10));

describe("B-01 expired order releases stock twice under concurrent expiry", () => {
  it("a second process holding a stale list must not restore stock again", () => {
    const o = order([{ variantId: V, qty: 2 }]);
    ageOrder(o.id, 31);
    expect(stockOf(V)).toBe(8);

    // "Process B": a second connection runs the same SELECT as expireStaleOrders() …
    const b = new Database(process.env.DATABASE_PATH!);
    const stale = b.prepare("SELECT id FROM orders WHERE status = 'pending_payment' AND created_at < ?").all(new Date(Date.now() - 30 * 60_000).toISOString()) as { id: string }[];
    // … meanwhile "process A" completes the expiry …
    expireStaleOrders();
    expect(stockOf(V)).toBe(10);
    // … then B executes the statements of expireStaleOrders()'s transaction for its stale list.
    b.transaction(() => {
      for (const s of stale) {
        for (const i of b.prepare("SELECT variant_id, qty FROM order_items WHERE order_id = ?").all(s.id) as { variant_id: string; qty: number }[])
          b.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?").run(i.qty, i.variant_id);
        b.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(s.id);
      }
    })();
    b.close();
    expect(stockOf(V)).toBe(10); // baseline: 12 — two phantom units created
  });
});

describe("B-02 per-order cap bypass with duplicate lines", () => {
  it("rejects 2×3 units of a variant whose cap is 3", () => {
    expect(() => order([{ variantId: V, qty: 3 }, { variantId: V, qty: 3 }])).toThrow();
  });
});

describe("B-03 order marked paid without any payment", () => {
  it("generic transition must not move pending_payment → paid", () => {
    const o = order();
    expect(() => transitionOrder(o.id, "paid", "admin:x")).toThrow();
  });
});

describe("B-04 inactive products remain purchasable", () => {
  it("rejects checkout of a deactivated product", () => {
    const p = getProductById("p-viana-noir")!;
    updateProduct(p.id, { active: false, summary: p.summary, b2b: p.b2b });
    try {
      expect(() => order()).toThrow();
    } finally {
      updateProduct(p.id, { active: true, summary: p.summary, b2b: p.b2b });
    }
  });
});

describe("B-05 cancelling a paid order leaves no refund obligation", () => {
  it("paid → cancelled must record that a refund is owed", () => {
    const o = order();
    db().prepare("UPDATE orders SET status='paid', payment_status='paid' WHERE id=?").run(o.id);
    transitionOrder(o.id, "cancelled", "admin:x");
    expect(getOrderById(o.id)!.paymentStatus).not.toBe("paid");
  });
});

describe("B-06 admin stock edit overwrites concurrent reservations (lost update)", () => {
  it("saving a stale absolute stock value must not resurrect reserved units", () => {
    const formValue = stockOf(V); // admin opens the form: 10
    order([{ variantId: V, qty: 2 }]); // customer reserves 2 → 8
    updateVariant(V, { retailPrice: 1_850_000, employeePrice: 1_295_000, stock: formValue, maxPerOrder: 3 });
    expect(stockOf(V)).toBe(8); // baseline: 10
  });
});

describe("B-07 duplicate order submission", () => {
  it("a double-submitted checkout must not create two orders", () => {
    const before = (db().prepare("SELECT COUNT(*) c FROM orders").get() as { c: number }).c;
    const input = { user: employee(), lines: [{ variantId: V, qty: 1 }], deliveryMethod: "workplace", address: null, paymentMethod: "gateway" as const };
    createOrder(input);
    createOrder(input);
    expect((db().prepare("SELECT COUNT(*) c FROM orders").get() as { c: number }).c - before).toBe(1);
  });
});

describe("B-08 quotation approvable after the RFQ was closed or re-opened", () => {
  const items = [{ productId: "b-nowruz", name: "x", qty: 100, unitLabel: "بسته", customization: [], note: "" }];
  const base = { userId: null, company: "شرکت آزمون", contactName: "آزمون", phone: "09125550000", occasion: "nowruz", budget: "unknown", deadline: "2030-01-01", items };
  const quote = (rfqId: string) =>
    issueQuotation(rfqId, { lines: [{ productId: "b-nowruz", name: "x", qty: 100, unitLabel: "بسته", unitPrice: 1000, note: "" }], discount: 0, validUntil: "2030-01-01", deliveryDate: "2030-01-01", terms: null }, "admin:x");

  it("closed RFQ", () => {
    const r = createRfq(base);
    transitionRfq(r.id, "in_review", "admin:x");
    const q = quote(r.id);
    transitionRfq(r.id, "closed", "admin:x");
    expect(() => decideQuotation(q.id, "approved", "customer", null)).toThrow();
  });

  it("RFQ moved back to review for re-quoting", () => {
    const r = createRfq(base);
    transitionRfq(r.id, "in_review", "admin:x");
    const q = quote(r.id);
    transitionRfq(r.id, "in_review", "admin:x");
    expect(() => decideQuotation(q.id, "approved", "customer", null)).toThrow();
  });
});

describe("B-09 open redirect in login `next`", () => {
  it("rejects backslash-prefixed targets", () => {
    expect(safeNext("/\\evil.example")).toBe("/account");
  });
});

describe("B-10 demo HR directory (incl. an admin) is seeded in production", () => {
  it("production database must not contain demo staff", () => {
    // TIARA_ENV is not consulted by the baseline seed at all
    const admins = db().prepare("SELECT COUNT(*) c FROM hr_directory WHERE admin = 1").get() as { c: number };
    expect(process.env.TIARA_ENV === "production" ? admins.c : 0).toBe(0);
    // demonstrate: seeding is unconditional
    expect(admins.c).toBe(0); // baseline: 1
  });
});

describe("B-11 OTP guessing is not bounded per mobile", () => {
  it("no more than 10 wrong guesses per mobile per day across re-issued codes", async () => {
    const { issueOtp, verifyOtp } = await import("@/lib/repo/users");
    const mobile = "09127770000";
    let guesses = 0;
    for (let cycle = 0; cycle < 4; cycle++) {
      db().prepare("UPDATE otp_codes SET created_at = ? WHERE mobile = ?").run(new Date(Date.now() - 61_000).toISOString(), mobile);
      const issued = issueOtp(mobile);
      if (!issued.ok) break;
      for (let i = 0; i < 6; i++) {
        const r = verifyOtp(mobile, issued.code === "00000" ? "11111" : "00000");
        if (r === "invalid") guesses++;
      }
    }
    expect(guesses).toBeLessThanOrEqual(10); // baseline: 20
  });
});
