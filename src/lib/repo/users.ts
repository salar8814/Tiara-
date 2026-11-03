import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db, newId, now } from "../db";
import type { Address, Eligibility, Role, User } from "../types";
import type { AddressInput } from "../validation";

const OTP_TTL_MS = 2 * 60_000;
const OTP_RESEND_MS = 60_000;
const OTP_MAX_ATTEMPTS = 5;
export const SESSION_TTL_DAYS = 30;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface UserRow {
  id: string;
  mobile: string;
  name: string | null;
  role: Role;
  eligibility: Eligibility;
  employee_code: string | null;
  unit: string | null;
  company: string | null;
  created_at: string;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  mobile: r.mobile,
  name: r.name,
  role: r.role,
  eligibility: r.eligibility,
  employeeCode: r.employee_code,
  unit: r.unit,
  company: r.company,
  createdAt: r.created_at,
});

// ── OTP ──

export type OtpIssue = { ok: true; code: string; expiresAt: string } | { ok: false; retryInSec: number };

export function issueOtp(mobile: string): OtpIssue {
  const existing = db().prepare("SELECT created_at FROM otp_codes WHERE mobile = ?").get(mobile) as
    | { created_at: string }
    | undefined;
  if (existing) {
    const elapsed = Date.now() - new Date(existing.created_at).getTime();
    if (elapsed < OTP_RESEND_MS) return { ok: false, retryInSec: Math.ceil((OTP_RESEND_MS - elapsed) / 1000) };
  }
  const code = String(randomInt(10000, 100000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  db()
    .prepare(
      `INSERT INTO otp_codes (mobile, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(mobile) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at`,
    )
    .run(mobile, sha(`${mobile}:${code}`), expiresAt, now());
  return { ok: true, code, expiresAt };
}

export type OtpCheck = "ok" | "expired" | "invalid" | "locked" | "missing";

export function verifyOtp(mobile: string, code: string): OtpCheck {
  const row = db().prepare("SELECT * FROM otp_codes WHERE mobile = ?").get(mobile) as
    | { code_hash: string; expires_at: string; attempts: number }
    | undefined;
  if (!row) return "missing";
  if (row.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired";
  const a = Buffer.from(row.code_hash);
  const b = Buffer.from(sha(`${mobile}:${code}`));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    db().prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE mobile = ?").run(mobile);
    return "invalid";
  }
  db().prepare("DELETE FROM otp_codes WHERE mobile = ?").run(mobile);
  return "ok";
}

// ── HR eligibility (demo directory stands in for the HR service) ──

interface DirRow {
  name: string;
  employee_code: string;
  unit: string;
  company: string;
  status: "active" | "pending" | "inactive";
  admin: number;
}

function resolveEligibility(mobile: string) {
  const dir = db().prepare("SELECT * FROM hr_directory WHERE mobile = ?").get(mobile) as DirRow | undefined;
  if (!dir) return { role: "customer" as Role, eligibility: "not_employee" as Eligibility, dir: null };
  const eligibility: Eligibility =
    dir.status === "active" ? "eligible" : dir.status === "pending" ? "pending" : "ineligible";
  return { role: (dir.admin ? "admin" : "employee") as Role, eligibility, dir };
}

/** Find or create the user and re-sync eligibility from the HR source on every login. */
export function upsertUserOnLogin(mobile: string): User {
  const { role, eligibility, dir } = resolveEligibility(mobile);
  const existing = db().prepare("SELECT * FROM users WHERE mobile = ?").get(mobile) as UserRow | undefined;
  if (existing) {
    db()
      .prepare(
        `UPDATE users SET role = ?, eligibility = ?, name = COALESCE(?, name), employee_code = ?, unit = COALESCE(?, unit), company = COALESCE(?, company) WHERE id = ?`,
      )
      .run(role, eligibility, dir?.name ?? null, dir?.employee_code ?? null, dir?.unit ?? null, dir?.company ?? null, existing.id);
    return getUser(existing.id)!;
  }
  const id = newId();
  db()
    .prepare(
      `INSERT INTO users (id, mobile, name, role, eligibility, employee_code, unit, company, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, mobile, dir?.name ?? null, role, eligibility, dir?.employee_code ?? null, dir?.unit ?? null, dir?.company ?? null, now());
  return getUser(id)!;
}

export function getUser(id: string): User | null {
  const r = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return r ? toUser(r) : null;
}

export function updateProfile(id: string, patch: { name: string; company: string | null; unit: string | null }) {
  db().prepare("UPDATE users SET name = ?, company = ?, unit = ? WHERE id = ?").run(patch.name, patch.company, patch.unit, id);
}

export function listUsers(): (User & { orders: number; rfqs: number; spent: number })[] {
  const rows = db()
    .prepare(
      `SELECT u.*,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders,
        (SELECT COUNT(*) FROM rfqs r WHERE r.user_id = u.id) AS rfqs,
        (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.payment_status IN ('paid','paid_sandbox')) AS spent
       FROM users u ORDER BY u.created_at DESC`,
    )
    .all() as (UserRow & { orders: number; rfqs: number; spent: number })[];
  return rows.map((r) => ({ ...toUser(r), orders: r.orders, rfqs: r.rfqs, spent: r.spent }));
}

// ── sessions ──

export function createSession(userId: string): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  db().prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha(token), userId, expiresAt.toISOString());
  return { token, expiresAt };
}

export function userForSession(token: string): User | null {
  const row = db()
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(sha(token)) as { user_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  return getUser(row.user_id);
}

export function deleteSession(token: string) {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

// ── addresses ──

interface AddressRow {
  id: string;
  user_id: string;
  label: string;
  recipient: string;
  mobile: string;
  province: string;
  city: string;
  street: string;
  plaque: string;
  unit: string;
  postal_code: string;
  is_default: number;
}

const toAddress = (r: AddressRow): Address => ({
  id: r.id,
  userId: r.user_id,
  label: r.label,
  recipient: r.recipient,
  mobile: r.mobile,
  province: r.province,
  city: r.city,
  street: r.street,
  plaque: r.plaque,
  unit: r.unit,
  postalCode: r.postal_code,
  isDefault: r.is_default === 1,
});

export function listAddresses(userId: string): Address[] {
  return (
    db().prepare("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC").all(userId) as AddressRow[]
  ).map(toAddress);
}

export function getAddress(userId: string, id: string): Address | null {
  const r = db().prepare("SELECT * FROM addresses WHERE user_id = ? AND id = ?").get(userId, id) as AddressRow | undefined;
  return r ? toAddress(r) : null;
}

export function addAddress(userId: string, input: AddressInput, makeDefault: boolean): Address {
  const id = newId();
  const tx = db().transaction(() => {
    const count = (db().prepare("SELECT COUNT(*) c FROM addresses WHERE user_id = ?").get(userId) as { c: number }).c;
    const isDefault = makeDefault || count === 0;
    if (isDefault) db().prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").run(userId);
    db()
      .prepare(
        `INSERT INTO addresses (id, user_id, label, recipient, mobile, province, city, street, plaque, unit, postal_code, is_default, created_at)
         VALUES (@id, @userId, @label, @recipient, @mobile, @province, @city, @street, @plaque, @unit, @postalCode, @isDefault, @createdAt)`,
      )
      .run({ id, userId, ...input, isDefault: isDefault ? 1 : 0, createdAt: now() });
  });
  tx();
  return getAddress(userId, id)!;
}

export function deleteAddress(userId: string, id: string) {
  const tx = db().transaction(() => {
    const target = getAddress(userId, id);
    if (!target) return;
    db().prepare("DELETE FROM addresses WHERE user_id = ? AND id = ?").run(userId, id);
    if (target.isDefault) {
      const next = db().prepare("SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId) as
        | { id: string }
        | undefined;
      if (next) db().prepare("UPDATE addresses SET is_default = 1 WHERE id = ?").run(next.id);
    }
  });
  tx();
}

export function setDefaultAddress(userId: string, id: string) {
  const tx = db().transaction(() => {
    db().prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").run(userId);
    db().prepare("UPDATE addresses SET is_default = 1 WHERE user_id = ? AND id = ?").run(userId, id);
  });
  tx();
}
