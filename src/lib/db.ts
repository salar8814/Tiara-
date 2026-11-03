import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedProducts } from "@/data/catalog";
import { demoDirectory } from "@/data/demo-directory";

// SQLite keeps the prototype self-contained and genuinely persistent.
// The repository modules in src/lib/repo/* are the only callers, so moving
// to PostgreSQL later means replacing this file and those queries.

const SCHEMA_VERSION = 1;

const schema = /* sql */ `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  channels TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  highlights TEXT NOT NULL,
  components TEXT NOT NULL,
  occasions TEXT NOT NULL,
  art TEXT NOT NULL,
  b2b TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  label TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  retail_price INTEGER NOT NULL CHECK (retail_price >= 0),
  employee_price INTEGER NOT NULL CHECK (employee_price >= 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  max_per_order INTEGER NOT NULL DEFAULT 5,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hr_directory (
  mobile TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  unit TEXT NOT NULL,
  company TEXT NOT NULL,
  status TEXT NOT NULL,
  admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  mobile TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL,
  eligibility TEXT NOT NULL,
  employee_code TEXT,
  unit TEXT,
  company TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  mobile TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,
  recipient TEXT NOT NULL,
  mobile TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  street TEXT NOT NULL,
  plaque TEXT NOT NULL,
  unit TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  payment_ref TEXT,
  delivery_method TEXT NOT NULL,
  subtotal_retail INTEGER NOT NULL,
  employee_discount INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  total INTEGER NOT NULL,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_retail INTEGER NOT NULL,
  unit_price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_entity ON events(entity, entity_id);

CREATE TABLE IF NOT EXISTS rfqs (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL,
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  department TEXT,
  occasion TEXT NOT NULL,
  budget TEXT NOT NULL,
  customization TEXT,
  deadline TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rfq_items (
  rfq_id TEXT NOT NULL REFERENCES rfqs(id),
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_label TEXT NOT NULL,
  customization TEXT NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  rfq_id TEXT NOT NULL REFERENCES rfqs(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  lines TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  vat INTEGER NOT NULL,
  total INTEGER NOT NULL,
  valid_until TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  terms TEXT,
  proforma_number TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS corporate_orders (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  rfq_id TEXT NOT NULL REFERENCES rfqs(id),
  quotation_id TEXT NOT NULL REFERENCES quotations(id),
  status TEXT NOT NULL,
  total INTEGER NOT NULL,
  reference TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  rfq_id TEXT REFERENCES rfqs(id),
  user_id TEXT REFERENCES users(id),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  topic TEXT,
  created_at TEXT NOT NULL
);
-- one active booking per slot
CREATE UNIQUE INDEX IF NOT EXISTS meetings_slot ON meetings(date, time) WHERE status IN ('requested','confirmed');
`;

function seed(db: Database.Database) {
  const insertProduct = db.prepare(`INSERT INTO products
    (id, slug, name, brand, category_id, kind, channels, summary, description, highlights, components, occasions, art, b2b, active, sort)
    VALUES (@id, @slug, @name, @brand, @categoryId, @kind, @channels, @summary, @description, @highlights, @components, @occasions, @art, @b2b, 1, @sort)`);
  const insertVariant = db.prepare(`INSERT INTO variants
    (id, product_id, label, sku, retail_price, employee_price, stock, max_per_order, sort)
    VALUES (@id, @productId, @label, @sku, @retailPrice, @employeePrice, @stock, @maxPerOrder, @sort)`);
  const insertDir = db.prepare(`INSERT INTO hr_directory (mobile, name, employee_code, unit, company, status, admin)
    VALUES (@mobile, @name, @employeeCode, @unit, @company, @status, @admin)`);

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
    p.variants.forEach((v, i) => insertVariant.run({ ...v, productId: p.id, sort: i }));
  }
  for (const r of demoDirectory) insertDir.run({ ...r, admin: r.admin ? 1 : 0 });
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
  db.exec(schema);
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
  if (!row) {
    db.transaction(() => {
      seed(db);
      db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
    })();
  }
  return db;
}

const g = globalThis as unknown as { __tiaraDb?: Database.Database };

export function db(): Database.Database {
  if (!g.__tiaraDb) g.__tiaraDb = open();
  return g.__tiaraDb;
}

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
