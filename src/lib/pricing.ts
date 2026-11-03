// Pure pricing rules shared by the client (display) and the server (authoritative
// recalculation at checkout). The server never trusts prices sent by the browser.

import { storeRules } from "@/data/rules";
import type { B2BConfig, Eligibility, PriceTier, Variant } from "./types";

export const canUseEmployeePrice = (eligibility: Eligibility | null | undefined) => eligibility === "eligible";

export function unitPrice(variant: Pick<Variant, "retailPrice" | "employeePrice">, eligible: boolean) {
  return eligible ? variant.employeePrice : variant.retailPrice;
}

export function discountPercent(v: Pick<Variant, "retailPrice" | "employeePrice">) {
  if (v.retailPrice <= 0) return 0;
  return Math.round(((v.retailPrice - v.employeePrice) / v.retailPrice) * 100);
}

export interface CartLineInput {
  variant: Pick<Variant, "retailPrice" | "employeePrice">;
  qty: number;
}

export function deliveryFee(methodId: string, payableSubtotal: number) {
  const m = storeRules.deliveryMethods.find((d) => d.id === methodId);
  if (!m) return 0;
  if (m.freeOver > 0 && payableSubtotal >= m.freeOver) return 0;
  return m.fee;
}

export function cartTotals(lines: CartLineInput[], eligible: boolean, deliveryMethodId: string) {
  const subtotalRetail = lines.reduce((s, l) => s + l.variant.retailPrice * l.qty, 0);
  const payable = lines.reduce((s, l) => s + unitPrice(l.variant, eligible) * l.qty, 0);
  const employeeDiscount = subtotalRetail - payable;
  const shipping = lines.length ? deliveryFee(deliveryMethodId, payable) : 0;
  return { subtotalRetail, employeeDiscount, shipping, total: payable + shipping, count: lines.reduce((s, l) => s + l.qty, 0) };
}

// ── B2B quantity rules ──

export function tierFor(tiers: PriceTier[], qty: number): PriceTier | null {
  let found: PriceTier | null = null;
  for (const t of [...tiers].sort((a, b) => a.minQty - b.minQty)) if (qty >= t.minQty) found = t;
  return found;
}

export function validateB2BQty(cfg: B2BConfig, qty: number): string | null {
  if (!Number.isInteger(qty) || qty <= 0) return "تعداد معتبر وارد کنید";
  if (qty < cfg.moq) return `حداقل سفارش ${cfg.moq.toLocaleString("fa-IR")} ${cfg.unitLabel} است`;
  if (cfg.step > 1 && qty % cfg.step !== 0)
    return `تعداد باید مضربی از ${cfg.step.toLocaleString("fa-IR")} باشد (اندازهٔ کارتن)`;
  return null;
}

export function snapQty(cfg: B2BConfig, qty: number) {
  const q = Math.max(cfg.moq, qty);
  return cfg.step > 1 ? Math.ceil(q / cfg.step) * cfg.step : q;
}

/** Price is never shown publicly when customisation is selected or the product is quote-only. */
export function b2bPriceVisible(cfg: B2BConfig, customization: string[]) {
  return cfg.priceMode === "tiered" && customization.length === 0;
}

export function leadTimeDays(cfg: B2BConfig, customization: string[]) {
  const extra = cfg.customization
    .filter((c) => customization.includes(c.id))
    .reduce((m, c) => Math.max(m, c.extraLeadDays), 0);
  return cfg.leadTimeDays + extra;
}
