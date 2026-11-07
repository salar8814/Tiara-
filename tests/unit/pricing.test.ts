import { describe, expect, it } from "vitest";
import { b2bPriceVisible, canUseEmployeePrice, cartTotals, deliveryFee, discountPercent, leadTimeDays, snapQty, tierFor, unitPrice, validateB2BQty } from "@/lib/pricing";
import type { B2BConfig } from "@/lib/types";

const v = { retailPrice: 1_850_000, employeePrice: 1_295_000 };
const cfg: B2BConfig = {
  moq: 100,
  step: 10,
  unitLabel: "عدد",
  priceMode: "tiered",
  tiers: [
    { minQty: 300, unitPrice: 1_040_000 },
    { minQty: 100, unitPrice: 1_120_000 },
    { minQty: 1000, unitPrice: 960_000 },
  ],
  customization: [
    { id: "engrave", label: "حکاکی", extraLeadDays: 10 },
    { id: "card", label: "کارت", extraLeadDays: 3 },
  ],
  leadTimeDays: 7,
};

describe("B2C pricing", () => {
  it("only eligible employees get the employee price", () => {
    expect(canUseEmployeePrice("eligible")).toBe(true);
    for (const e of ["pending", "ineligible", "not_employee", null, undefined] as const) expect(canUseEmployeePrice(e)).toBe(false);
    expect(unitPrice(v, true)).toBe(1_295_000);
    expect(unitPrice(v, false)).toBe(1_850_000);
  });

  it("discount percent is rounded and safe for zero retail", () => {
    expect(discountPercent(v)).toBe(30);
    expect(discountPercent({ retailPrice: 0, employeePrice: 0 })).toBe(0);
  });

  it("courier fee applies below the free-shipping threshold, workplace delivery is free", () => {
    expect(deliveryFee("courier", 2_999_999)).toBe(80_000);
    expect(deliveryFee("courier", 3_000_000)).toBe(0);
    expect(deliveryFee("workplace", 100)).toBe(0);
    expect(deliveryFee("unknown", 100)).toBe(0);
  });

  it("totals: retail subtotal, discount, shipping and payable are consistent", () => {
    const t = cartTotals([{ variant: v, qty: 2 }, { variant: { retailPrice: 355_000, employeePrice: 255_000 }, qty: 1 }], true, "courier");
    expect(t.subtotalRetail).toBe(2 * 1_850_000 + 355_000);
    expect(t.employeeDiscount).toBe(2 * 555_000 + 100_000);
    expect(t.shipping).toBe(80_000); // payable 2,845,000 is below the 3,000,000 free-shipping threshold
    expect(t.total).toBe(t.subtotalRetail - t.employeeDiscount + t.shipping);
  });

  it("free shipping threshold is evaluated on the payable (discounted) amount", () => {
    const t = cartTotals([{ variant: v, qty: 2 }], true, "courier"); // payable 2,590,000
    expect(t.shipping).toBe(80_000);
    expect(t.total).toBe(2_590_000 + 80_000);
    const retail = cartTotals([{ variant: v, qty: 2 }], false, "courier"); // payable 3,700,000
    expect(retail.shipping).toBe(0);
  });

  it("empty cart has no shipping", () => {
    expect(cartTotals([], true, "courier")).toMatchObject({ total: 0, shipping: 0, count: 0 });
  });
});

describe("B2B quantity rules", () => {
  it("enforces MOQ and carton multiples", () => {
    expect(validateB2BQty(cfg, 90)).toMatch(/حداقل سفارش/);
    expect(validateB2BQty(cfg, 105)).toMatch(/مضربی/);
    expect(validateB2BQty(cfg, 0)).not.toBeNull();
    expect(validateB2BQty(cfg, 10.5)).not.toBeNull();
    expect(validateB2BQty(cfg, 100)).toBeNull();
    expect(validateB2BQty(cfg, 1230)).toBeNull();
  });

  it("snaps to the nearest valid quantity at or above MOQ", () => {
    expect(snapQty(cfg, 1)).toBe(100);
    expect(snapQty(cfg, 101)).toBe(110);
    expect(snapQty(cfg, 120)).toBe(120);
  });

  it("selects the highest applicable volume tier regardless of tier order", () => {
    expect(tierFor(cfg.tiers, 99)).toBeNull();
    expect(tierFor(cfg.tiers, 100)?.unitPrice).toBe(1_120_000);
    expect(tierFor(cfg.tiers, 299)?.unitPrice).toBe(1_120_000);
    expect(tierFor(cfg.tiers, 300)?.unitPrice).toBe(1_040_000);
    expect(tierFor(cfg.tiers, 5000)?.unitPrice).toBe(960_000);
  });

  it("never shows a price for customised or quote-only items", () => {
    expect(b2bPriceVisible(cfg, [])).toBe(true);
    expect(b2bPriceVisible(cfg, ["card"])).toBe(false);
    expect(b2bPriceVisible({ ...cfg, priceMode: "quote" }, [])).toBe(false);
  });

  it("lead time adds the longest customisation, not the sum", () => {
    expect(leadTimeDays(cfg, [])).toBe(7);
    expect(leadTimeDays(cfg, ["card"])).toBe(10);
    expect(leadTimeDays(cfg, ["card", "engrave"])).toBe(17);
    expect(leadTimeDays(cfg, ["unknown"])).toBe(7);
  });
});
