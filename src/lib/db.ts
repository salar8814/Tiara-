import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedProducts } from "@/data/catalog";
import { demoDirectory, demoStaff } from "@/data/demo-directory";
import { ConfigError, demoAllowed } from "./config";
import { LATEST_VERSION, migrations } from "./migrations";

// SQLite (WAL) is the system of record for this deployment model: ONE
// application process per database file. See docs/ARCHITECTURE_DECISIONS.md
// (ADR-002) for the constraints and the PostgreSQL migration triggers.
// All SQL lives in src/lib/repo/* and src/lib/services/*.

function currentVersion(db: Database.Database): number {
  const hasMeta = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").get();
  if (!hasMeta) return 0;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
  return row ? Number(row.value) : 0;
}

function migrate(db: Database.Database) {
  const from = currentVersion(db);
  if (from > LATEST_VERSION) throw new ConfigError(`Database schema v${from} is newer than this build (v${LATEST_VERSION}).`);
  for (const m of migrations) {
    if (m.version <= from) continue;
    db.transaction(() => {
      m.up(db);
      db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(m.version));
    }).immediate();
  }
}

const ts = () => new Date().toISOString();

function seedCatalog(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) c FROM products").get() as { c: number }).c;
  if (count > 0) return;
  const insertProduct = db.prepare(`INSERT INTO products
    (id, slug, name, brand, category_id, kind, channels, summary, description, highlights, components, occasions, art, b2b, active, sort)
    VALUES (@id, @slug, @name, @brand, @categoryId, @kind, @channels, @summary, @description, @highlights, @components, @occasions, @art, @b2b, 1, @sort)`);
  const insertVariant = db.prepare(`INSERT INTO variants
    (id, product_id, label, sku, retail_price, employee_price, stock, max_per_order, sort)
    VALUES (@id, @productId, @label, @sku, @retailPrice, @employeePrice, @stock, @maxPerOrder, @sort)`);
  const ledger = db.prepare(`INSERT INTO inventory_movements (variant_id, delta, reason, ref, note, actor, stock_after, created_at)
    VALUES (?, ?, 'initial', NULL, 'catalog seed', 'system:seed', ?, ?)`);
  db.transaction(() => {
    for (const p of seedProducts) {
      insertProduct.run({
        ...p,
        channels: JSON.stringify(p.channels),
        highlights: JSON.stringify(p.highlights),
        components: JSON.stringify(p.components),
        occasions: JSON.stringify(p.occasions),
        art: JSON.stringify(p.art),
        b2b: p.b2b ? JSON.stringify(p.b2b) : null,
      });
      p.variants.forEach((v, i) => {
        insertVariant.run({ ...v, productId: p.id, sort: i });
        if (v.stock > 0) ledger.run(v.id, v.stock, v.stock, ts());
      });
    }
  }).immediate();
}

/** Demo HR records and demo staff exist only outside production. */
function seedDemo(db: Database.Database) {
  const demoMobiles = demoDirectory.map((d) => d.mobile);
  const placeholders = demoMobiles.map(() => "?").join(",");
  if (!demoAllowed()) {
    const leaked = db.prepare(`SELECT COUNT(*) c FROM hr_directory WHERE mobile IN (${placeholders})`).get(...demoMobiles) as { c: number };
    const leakedStaff = db.prepare(`SELECT COUNT(*) c FROM staff_roles WHERE granted_by = 'system:demo'`).get() as { c: number };
    if (leaked.c > 0 || leakedStaff.c > 0) {
      throw new ConfigError("Demo HR records or demo staff roles are present in a production database. Remove them before starting.");
    }
    return;
  }
  const count = (db.prepare("SELECT COUNT(*) c FROM hr_directory").get() as { c: number }).c;
  if (count > 0) return;
  db.transaction(() => {
    const dir = db.prepare(`INSERT INTO hr_directory (mobile, name, employee_code, unit, company, status, admin) VALUES (@mobile, @name, @employeeCode, @unit, @company, @status, 0)`);
    for (const r of demoDirectory) dir.run(r);
    const role = db.prepare(`INSERT OR IGNORE INTO staff_roles (mobile, role, granted_by, granted_at) VALUES (?, ?, 'system:demo', ?)`);
    for (const s of demoStaff) for (const r of s.roles) role.run(s.mobile, r, ts());
  }).immediate();
}

function open(): Database.Database {
  const file = process.env.DATABASE_PATH
    ? path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH)
    : path.join(process.cwd(), "data", "tiara.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  migrate(db);
  seedCatalog(db);
  seedDemo(db);
  return db;
}

const g = globalThis as unknown as { __tiaraDb?: Database.Database };

export function db(): Database.Database {
  if (!g.__tiaraDb) g.__tiaraDb = open();
  return g.__tiaraDb;
}

/**
 * Runs `fn` in a BEGIN IMMEDIATE transaction: the write lock is taken up front,
 * so a read-then-write sequence cannot interleave with another process's write.
 * Nested calls become savepoints of the outer transaction.
 */
export function tx<T>(fn: () => T): T {
  return db().transaction(fn).immediate();
}

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
