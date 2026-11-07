// Interim HR integration: replaces the eligibility directory with a CSV export
// supplied by Mammut Group HR. Columns (header required):
//   mobile,name,employee_code,unit,company,status      status ∈ active|pending|inactive
// Usage: npm run hr:import -- ./hr-export.csv [--dry-run]
// The import is all-or-nothing and is written to the audit log.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const [csvPath, flag] = process.argv.slice(2);
if (!csvPath) {
  console.error("usage: npm run hr:import -- <file.csv> [--dry-run]");
  process.exit(2);
}
const lines = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
const header = lines.shift()?.split(",").map((h) => h.trim());
const expected = ["mobile", "name", "employee_code", "unit", "company", "status"];
if (JSON.stringify(header) !== JSON.stringify(expected)) {
  console.error(`header must be: ${expected.join(",")}`);
  process.exit(2);
}
const toLatin = (s) => s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
const rows = [];
const errors = [];
const seen = new Set();
lines.forEach((line, i) => {
  const cols = line.split(",").map((c) => c.trim());
  const [mobile, name, code, unit, company, status] = [toLatin(cols[0] ?? ""), ...cols.slice(1)];
  if (cols.length !== 6) errors.push(`line ${i + 2}: expected 6 columns`);
  else if (!/^09\d{9}$/.test(mobile)) errors.push(`line ${i + 2}: invalid mobile`);
  else if (!["active", "pending", "inactive"].includes(status)) errors.push(`line ${i + 2}: invalid status`);
  else if (seen.has(mobile)) errors.push(`line ${i + 2}: duplicate mobile`);
  else if (!name || !code) errors.push(`line ${i + 2}: name and employee_code are required`);
  else {
    seen.add(mobile);
    rows.push({ mobile, name, code, unit, company, status });
  }
});
if (errors.length) {
  console.error(errors.slice(0, 50).join("\n"));
  console.error(`${errors.length} error(s); nothing imported`);
  process.exit(1);
}
if (flag === "--dry-run") {
  console.log(`valid: ${rows.length} records (dry run, nothing written)`);
  process.exit(0);
}
const db = new Database(path.resolve(process.env.DATABASE_PATH ?? "./data/tiara.db"), { fileMustExist: true });
db.transaction(() => {
  db.prepare("DELETE FROM hr_directory").run();
  const ins = db.prepare("INSERT INTO hr_directory (mobile, name, employee_code, unit, company, status, admin) VALUES (?, ?, ?, ?, ?, ?, 0)");
  for (const r of rows) ins.run(r.mobile, r.name, r.code, r.unit, r.company, r.status);
  db.prepare("INSERT INTO audit_log (actor, action, entity, entity_id, before, after, created_at) VALUES (?, 'hr.import', 'hr_directory', ?, NULL, ?, ?)")
    .run(`cli:${process.env.USER ?? "operator"}`, path.basename(csvPath), JSON.stringify({ records: rows.length }), new Date().toISOString());
})();
console.log(`imported ${rows.length} HR records; eligibility applies at each user's next login/checkout`);
