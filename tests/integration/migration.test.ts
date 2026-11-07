// A database created by the baseline build (schema v1) must upgrade in place.
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrations } from "@/lib/migrations";

describe("schema migration v1 → v2", () => {
  it("moves legacy admins to staff_roles, opens the inventory ledger and adds constraints", async () => {
    const raw = new Database(process.env.DATABASE_PATH!);
    migrations[0].up(raw);
    raw.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '1')").run();
    raw.prepare(`INSERT INTO products (id, slug, name, brand, category_id, kind, channels, summary, description, highlights, components, occasions, art, b2b, active, sort)
      VALUES ('p1','p1','x','x','home','single','["b2c"]','x','x','[]','[]','[]','{"shape":"box","bg":"#fff","body":"#000","accent":"#000"}',NULL,1,0)`).run();
    raw.prepare("INSERT INTO variants (id, product_id, label, sku, retail_price, employee_price, stock, max_per_order, sort) VALUES ('v1','p1','x','SKU1',100,80,7,3,0)").run();
    raw.prepare("INSERT INTO users (id, mobile, name, role, eligibility, created_at) VALUES ('u1','09120000555','old admin','admin','eligible','2025-01-01')").run();
    raw.close();

    const { db } = await import("@/lib/db");
    const { reconcile } = await import("@/lib/repo/inventory");
    expect((db().prepare("SELECT value FROM meta WHERE key='schema_version'").get() as { value: string }).value).toBe("2");
    expect(db().prepare("SELECT role FROM staff_roles WHERE mobile = '09120000555'").all()).toEqual([{ role: "admin" }]);
    expect((db().prepare("SELECT role FROM users WHERE id = 'u1'").get() as { role: string }).role).toBe("employee");
    expect(reconcile()).toEqual([]);
    expect(() => db().prepare("UPDATE orders SET status = 'bogus'").run()).not.toThrow(); // no rows
    expect(() =>
      db().prepare("INSERT INTO orders (id, code, user_id, status, payment_method, payment_status, delivery_method, subtotal_retail, employee_discount, shipping, total, created_at, updated_at) VALUES ('o','c','u1','bogus','gateway','unpaid','workplace',0,0,0,0,'x','x')").run(),
    ).toThrow(/invalid orders.status/);
    // existing catalog is kept; seeding does not duplicate it
    expect((db().prepare("SELECT COUNT(*) c FROM products").get() as { c: number }).c).toBe(1);
  });
});
