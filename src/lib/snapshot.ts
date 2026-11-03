import "server-only";
import { listProducts } from "./repo/products";
import type { ProductArt } from "./types";

/** Serializable B2C variant data handed to client components (cart, checkout). */
export interface VariantSnapshot {
  variantId: string;
  productName: string;
  slug: string;
  label: string;
  retailPrice: number;
  employeePrice: number;
  stock: number;
  maxPerOrder: number;
  art: ProductArt;
}

export function b2cSnapshot(): Record<string, VariantSnapshot> {
  const out: Record<string, VariantSnapshot> = {};
  for (const p of listProducts({ channel: "b2c" })) {
    for (const v of p.variants) {
      out[v.id] = {
        variantId: v.id,
        productName: p.name,
        slug: p.slug,
        label: v.label,
        retailPrice: v.retailPrice,
        employeePrice: v.employeePrice,
        stock: v.stock,
        maxPerOrder: v.maxPerOrder,
        art: p.art,
      };
    }
  }
  return out;
}

export interface B2BSnapshot {
  productId: string;
  name: string;
  slug: string;
  summary: string;
  kind: "single" | "bundle";
  art: ProductArt;
  moq: number;
  step: number;
  unitLabel: string;
  priceMode: "tiered" | "quote";
  tiers: { minQty: number; unitPrice: number }[];
  customization: { id: string; label: string; extraLeadDays: number }[];
  leadTimeDays: number;
}

export function b2bSnapshot(includeTiers: boolean): Record<string, B2BSnapshot> {
  const out: Record<string, B2BSnapshot> = {};
  for (const p of listProducts({ channel: "b2b" })) {
    if (!p.b2b) continue;
    out[p.id] = {
      productId: p.id,
      name: p.name,
      slug: p.slug,
      summary: p.summary,
      kind: p.kind,
      art: p.art,
      moq: p.b2b.moq,
      step: p.b2b.step,
      unitLabel: p.b2b.unitLabel,
      priceMode: p.b2b.priceMode,
      // Volume prices are withheld from anonymous visitors.
      tiers: includeTiers ? p.b2b.tiers : [],
      customization: p.b2b.customization,
      leadTimeDays: p.b2b.leadTimeDays,
    };
  }
  return out;
}
