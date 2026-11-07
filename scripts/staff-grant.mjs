// Production bootstrap and emergency access management for staff roles.
//   npm run staff:grant -- 09xxxxxxxxx admin        grant
//   npm run staff:grant -- 09xxxxxxxxx admin --revoke
// Runs directly against DATABASE_PATH; the app must have been started once so
// the schema is migrated. Every change is written to the audit log and the
// person's sessions are ended.
import Database from "better-sqlite3";
import path from "node:path";

const [mobile, role, flag] = process.argv.slice(2);
const roles = ["admin", "sales", "finance", "warehouse"];
if (!/^09\d{9}$/.test(mobile ?? "") || !roles.includes(role ?? "")) {
  console.error("usage: npm run staff:grant -- <09xxxxxxxxx> <admin|sales|finance|warehouse> [--revoke]");
  process.exit(2);
}
const file = path.resolve(process.env.DATABASE_PATH ?? "./data/tiara.db");
const db = new Database(file, { fileMustExist: true });
const v = db.prepare("SELECT value FROM meta WHERE key='schema_version'").get();
if (!v || Number(v.value) < 2) {
  console.error("database schema is older than v2 — start the application once to migrate it");
  process.exit(1);
}
const actor = `cli:${process.env.USER ?? "operator"}`;
const now = new Date().toISOString();
db.transaction(() => {
  if (flag === "--revoke") db.prepare("DELETE FROM staff_roles WHERE mobile = ? AND role = ?").run(mobile, role);
  else db.prepare("INSERT OR IGNORE INTO staff_roles (mobile, role, granted_by, granted_at) VALUES (?, ?, ?, ?)").run(mobile, role, actor, now);
  const u = db.prepare("SELECT id FROM users WHERE mobile = ?").get(mobile);
  if (u) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  db.prepare("INSERT INTO audit_log (actor, action, entity, entity_id, before, after, created_at) VALUES (?, ?, 'staff_role', ?, NULL, ?, ?)")
    .run(actor, flag === "--revoke" ? "staff.revoke" : "staff.grant", mobile, JSON.stringify({ role }), now);
})();
console.log(`${flag === "--revoke" ? "revoked" : "granted"} ${role} for ${mobile}`);
