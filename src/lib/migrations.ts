import type Database from "better-sqlite3";

// Ordered, append-only schema migrations. Never edit a migration that has
// shipped; add a new one. `meta.schema_version` records the last applied step.
//
// v1 is the baseline schema of commit d10c915, kept byte-for-byte so databases
// created by that version upgrade in place.

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const V1 = /* sql */ `
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

const enumTrigger = (table: string, column: string, values: string[]) => {
  const list = values.map((v) => `'${v}'`).join(",");
  return `
CREATE TRIGGER IF NOT EXISTS ${table}_${column}_ins BEFORE INSERT ON ${table}
  WHEN NEW.${column} NOT IN (${list}) BEGIN SELECT RAISE(ABORT, 'invalid ${table}.${column}'); END;
CREATE TRIGGER IF NOT EXISTS ${table}_${column}_upd BEFORE UPDATE OF ${column} ON ${table}
  WHEN NEW.${column} NOT IN (${list}) BEGIN SELECT RAISE(ABORT, 'invalid ${table}.${column}'); END;`;
};

const V2 = /* sql */ `
-- staff roles are keyed by mobile so they can be granted before first login
CREATE TABLE staff_roles (
  mobile TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','sales','finance','warehouse')),
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (mobile, role)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before TEXT,
  after TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_entity ON audit_log(entity, entity_id);
CREATE INDEX audit_created ON audit_log(created_at);

-- append-only ledger; variants.stock must always equal the sum of movements
CREATE TABLE inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id TEXT NOT NULL REFERENCES variants(id),
  delta INTEGER NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL CHECK (reason IN ('initial','reserve','release','adjust')),
  ref TEXT,
  note TEXT,
  actor TEXT NOT NULL,
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  created_at TEXT NOT NULL
);
CREATE INDEX inventory_variant ON inventory_movements(variant_id, id);
CREATE TRIGGER inventory_movements_no_update BEFORE UPDATE ON inventory_movements BEGIN SELECT RAISE(ABORT, 'inventory ledger is append-only'); END;
CREATE TRIGGER inventory_movements_no_delete BEFORE DELETE ON inventory_movements BEGIN SELECT RAISE(ABORT, 'inventory ledger is append-only'); END;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

ALTER TABLE orders ADD COLUMN idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN refund_ref TEXT;
-- one bank/PSP reference can settle only one order
CREATE UNIQUE INDEX orders_payment_ref ON orders(payment_ref) WHERE payment_ref IS NOT NULL;
CREATE UNIQUE INDEX orders_idempotency ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX orders_user ON orders(user_id, created_at);
CREATE INDEX orders_status ON orders(status, created_at);
CREATE INDEX order_items_order ON order_items(order_id);

ALTER TABLE rfqs ADD COLUMN assigned_to TEXT;
CREATE INDEX rfqs_user ON rfqs(user_id);
CREATE INDEX rfqs_phone ON rfqs(phone);
CREATE INDEX rfqs_status ON rfqs(status, created_at);
CREATE INDEX rfq_items_rfq ON rfq_items(rfq_id);

CREATE UNIQUE INDEX quotations_version ON quotations(rfq_id, version);
CREATE UNIQUE INDEX quotations_one_open ON quotations(rfq_id) WHERE status = 'issued';
CREATE UNIQUE INDEX quotations_one_approved ON quotations(rfq_id) WHERE status = 'approved';
CREATE UNIQUE INDEX quotations_proforma ON quotations(proforma_number) WHERE proforma_number IS NOT NULL;
CREATE UNIQUE INDEX corporate_orders_rfq ON corporate_orders(rfq_id);

ALTER TABLE sessions ADD COLUMN created_at TEXT;
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX addresses_user ON addresses(user_id);
CREATE INDEX meetings_user ON meetings(user_id);
CREATE INDEX meetings_rfq ON meetings(rfq_id);

CREATE TRIGGER order_items_qty BEFORE INSERT ON order_items WHEN NEW.qty <= 0 OR NEW.unit_price < 0
  BEGIN SELECT RAISE(ABORT, 'invalid order item'); END;
CREATE TRIGGER rfq_items_qty BEFORE INSERT ON rfq_items WHEN NEW.qty <= 0
  BEGIN SELECT RAISE(ABORT, 'invalid rfq item'); END;
CREATE TRIGGER orders_amounts BEFORE INSERT ON orders WHEN NEW.total < 0 OR NEW.shipping < 0 OR NEW.employee_discount < 0
  BEGIN SELECT RAISE(ABORT, 'invalid order amounts'); END;
${enumTrigger("orders", "status", ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"])}
${enumTrigger("orders", "payment_status", ["unpaid", "paid", "paid_sandbox", "failed", "refund_pending", "refunded"])}
${enumTrigger("rfqs", "status", ["submitted", "in_review", "quoted", "approved", "converted", "declined", "closed"])}
${enumTrigger("quotations", "status", ["issued", "approved", "declined", "superseded", "expired", "withdrawn"])}
${enumTrigger("corporate_orders", "status", ["confirmed", "in_production", "shipped", "delivered"])}
${enumTrigger("meetings", "status", ["requested", "confirmed", "cancelled", "completed"])}
${enumTrigger("users", "role", ["employee", "customer"])}
`;

export const migrations: Migration[] = [
  { version: 1, name: "baseline", up: (db) => db.exec(V1) },
  {
    version: 2,
    name: "integrity, roles, audit, inventory ledger, rate limits",
    up: (db) => {
      // v1 stored admins as users.role='admin'; move them to staff_roles before the role trigger exists.
      db.exec(`CREATE TABLE IF NOT EXISTS _v1_admins AS SELECT mobile FROM users WHERE role = 'admin'`);
      db.exec(`UPDATE users SET role = 'employee' WHERE role = 'admin'`);
      db.exec(V2);
      db.exec(`INSERT OR IGNORE INTO staff_roles (mobile, role, granted_by, granted_at)
               SELECT mobile, 'admin', 'migration:v2', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM _v1_admins`);
      db.exec(`DROP TABLE _v1_admins`);
      db.exec(`UPDATE sessions SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE created_at IS NULL`);
      // Opening ledger entry for existing stock so the ledger reconciles with variants.stock.
      db.exec(`INSERT INTO inventory_movements (variant_id, delta, reason, ref, note, actor, stock_after, created_at)
               SELECT id, stock, 'initial', NULL, 'opening balance (migration v2)', 'migration:v2', stock, strftime('%Y-%m-%dT%H:%M:%fZ','now')
               FROM variants WHERE stock > 0`);
    },
  },
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
