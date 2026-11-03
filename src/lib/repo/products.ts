import "server-only";
import { db } from "../db";
import type { B2BConfig, Channel, Product, Variant } from "../types";

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category_id: string;
  kind: "single" | "bundle";
  channels: string;
  summary: string;
  description: string;
  highlights: string;
  components: string;
  occasions: string;
  art: string;
  b2b: string | null;
  active: number;
  sort: number;
}

interface VariantRow {
  id: string;
  product_id: string;
  label: string;
  sku: string;
  retail_price: number;
  employee_price: number;
  stock: number;
  max_per_order: number;
}

const toVariant = (r: VariantRow): Variant => ({
  id: r.id,
  productId: r.product_id,
  label: r.label,
  sku: r.sku,
  retailPrice: r.retail_price,
  employeePrice: r.employee_price,
  stock: r.stock,
  maxPerOrder: r.max_per_order,
});

function hydrate(rows: ProductRow[]): Product[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const variants = db()
    .prepare(`SELECT * FROM variants WHERE product_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort`)
    .all(...ids) as VariantRow[];
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    categoryId: r.category_id,
    kind: r.kind,
    channels: JSON.parse(r.channels) as Channel[],
    summary: r.summary,
    description: r.description,
    highlights: JSON.parse(r.highlights),
    components: JSON.parse(r.components),
    occasions: JSON.parse(r.occasions),
    art: JSON.parse(r.art),
    b2b: r.b2b ? (JSON.parse(r.b2b) as B2BConfig) : null,
    active: r.active === 1,
    sort: r.sort,
    variants: variants.filter((v) => v.product_id === r.id).map(toVariant),
  }));
}

export function listProducts(opts: { channel?: Channel; includeInactive?: boolean } = {}): Product[] {
  const rows = db()
    .prepare(`SELECT * FROM products ${opts.includeInactive ? "" : "WHERE active = 1"} ORDER BY sort`)
    .all() as ProductRow[];
  const all = hydrate(rows);
  return opts.channel ? all.filter((p) => p.channels.includes(opts.channel!)) : all;
}

export function getProductBySlug(slug: string, channel?: Channel): Product | null {
  const row = db().prepare("SELECT * FROM products WHERE slug = ? AND active = 1").get(slug) as ProductRow | undefined;
  if (!row) return null;
  const [p] = hydrate([row]);
  if (channel && !p.channels.includes(channel)) return null;
  return p;
}

export function getProductById(id: string): Product | null {
  const row = db().prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  return row ? hydrate([row])[0] : null;
}

export function getVariants(ids: string[]): Map<string, Variant> {
  if (ids.length === 0) return new Map();
  const rows = db()
    .prepare(`SELECT * FROM variants WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as VariantRow[];
  return new Map(rows.map((r) => [r.id, toVariant(r)]));
}

// ── admin mutations ──

export function updateVariant(id: string, patch: Pick<Variant, "retailPrice" | "employeePrice" | "stock" | "maxPerOrder">) {
  db()
    .prepare(
      `UPDATE variants SET retail_price = @retailPrice, employee_price = @employeePrice, stock = @stock, max_per_order = @maxPerOrder WHERE id = @id`,
    )
    .run({ id, ...patch });
}

export function updateProduct(id: string, patch: { active: boolean; summary: string; b2b: B2BConfig | null }) {
  db()
    .prepare(`UPDATE products SET active = ?, summary = ?, b2b = ? WHERE id = ?`)
    .run(patch.active ? 1 : 0, patch.summary, patch.b2b ? JSON.stringify(patch.b2b) : null, id);
}
