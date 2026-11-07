import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db, newId, now, tx } from "../db";
import { hit, limits, peek } from "../rate-limit";
import type { Address, Eligibility, Role, StaffRole, User } from "../types";
import type { AddressInput } from "../validation";

const OTP_TTL_MS = 2 * 60_000;
const OTP_RESEND_MS = 60_000;
const OTP_MAX_ATTEMPTS = 5;
export const SESSION_TTL_DAYS = 14;
export const MAX_ADDRESSES = 20;

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

const staffRolesFor = (mobile: string): StaffRole[] =>
  (db().prepare("SELECT role FROM staff_roles WHERE mobile = ? ORDER BY role").all(mobile) as { role: StaffRole }[]).map((r) => r.role);

const toUser = (r: UserRow): User => ({
  id: r.id,
  mobile: r.mobile,
  name: r.name,
  role: r.role,
  eligibility: r.eligibility,
  employeeCode: r.employee_code,
  unit: r.unit,
  company: r.company,
  staffRoles: staffRolesFor(r.mobile),
  createdAt: r.created_at,
});

// ── OTP ──

export type OtpIssue =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; reason: "cooldown" | "rate_limited" | "locked"; retryInSec: number };

/**
 * Issues a new code. Abuse controls (all per mobile, persisted):
 * 60 s resend cooldown · 5 codes per hour · refused while the daily wrong-guess budget is exhausted.
 * Per-IP limits are applied by the caller (it knows the request).
 */
export function issueOtp(mobile: string, nowMs = Date.now()): OtpIssue {
  if (!peek(`otp:fail:${mobile}`, limits.otpFailuresPerMobile, nowMs)) {
    return { ok: false, reason: "locked", retryInSec: limits.otpFailuresPerMobile.windowSec };
  }
  const existing = db().prepare("SELECT created_at FROM otp_codes WHERE mobile = ?").get(mobile) as { created_at: string } | undefined;
  if (existing) {
    const elapsed = nowMs - new Date(existing.created_at).getTime();
    if (elapsed < OTP_RESEND_MS) return { ok: false, reason: "cooldown", retryInSec: Math.ceil((OTP_RESEND_MS - elapsed) / 1000) };
  }
  const quota = hit(`otp:issue:${mobile}`, limits.otpIssuePerMobile, nowMs);
  if (!quota.ok) return { ok: false, reason: "rate_limited", retryInSec: quota.retryAfterSec };
  const code = String(randomInt(10000, 100000));
  const expiresAt = new Date(nowMs + OTP_TTL_MS).toISOString();
  db()
    .prepare(
      `INSERT INTO otp_codes (mobile, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(mobile) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at`,
    )
    .run(mobile, sha(`${mobile}:${code}`), expiresAt, new Date(nowMs).toISOString());
  return { ok: true, code, expiresAt };
}

export type OtpCheck = "ok" | "expired" | "invalid" | "locked" | "missing";

export function verifyOtp(mobile: string, code: string): OtpCheck {
  return tx((): OtpCheck => {
    if (!peek(`otp:fail:${mobile}`, limits.otpFailuresPerMobile)) return "locked";
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
      hit(`otp:fail:${mobile}`, limits.otpFailuresPerMobile);
      return "invalid";
    }
    db().prepare("DELETE FROM otp_codes WHERE mobile = ?").run(mobile);
    return "ok";
  });
}

// ── HR eligibility (demo directory stands in for the HR service) ──

interface DirRow {
  name: string;
  employee_code: string;
  unit: string;
  company: string;
  status: "active" | "pending" | "inactive";
}

/**
 * Eligibility source. In production this table is filled only by the HR
 * integration / `npm run hr:import`; demo rows exist only outside production.
 */
export function resolveEligibility(mobile: string) {
  const dir = db().prepare("SELECT * FROM hr_directory WHERE mobile = ?").get(mobile) as DirRow | undefined;
  if (!dir) return { role: "customer" as Role, eligibility: "not_employee" as Eligibility, dir: null };
  const eligibility: Eligibility =
    dir.status === "active" ? "eligible" : dir.status === "pending" ? "pending" : "ineligible";
  return { role: "employee" as Role, eligibility, dir };
}

/** Re-reads HR state for a signed-in user (used at checkout, so leavers lose pricing immediately). */
export function refreshEligibility(user: User): User {
  const { role, eligibility } = resolveEligibility(user.mobile);
  if (role !== user.role || eligibility !== user.eligibility) {
    db().prepare("UPDATE users SET role = ?, eligibility = ? WHERE id = ?").run(role, eligibility, user.id);
  }
  return getUser(user.id)!;
}

/** Find or create the user and re-sync eligibility from the HR source on every login. */
export function upsertUserOnLogin(mobile: string): User {
  const { role, eligibility, dir } = resolveEligibility(mobile);
  // Single atomic statement: concurrent first logins for one mobile (double submit,
  // two tabs, two processes) must not race on the UNIQUE(mobile) constraint.
  const row = db()
    .prepare(
      `INSERT INTO users (id, mobile, name, role, eligibility, employee_code, unit, company, created_at)
       VALUES (@id, @mobile, @name, @role, @eligibility, @code, @unit, @company, @now)
       ON CONFLICT(mobile) DO UPDATE SET
         role = excluded.role,
         eligibility = excluded.eligibility,
         name = COALESCE(excluded.name, users.name),
         employee_code = excluded.employee_code,
         unit = COALESCE(excluded.unit, users.unit),
         company = COALESCE(excluded.company, users.company)
       RETURNING id`,
    )
    .get({ id: newId(), mobile, name: dir?.name ?? null, role, eligibility, code: dir?.employee_code ?? null, unit: dir?.unit ?? null, company: dir?.company ?? null, now: now() }) as { id: string };
  return getUser(row.id)!;
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
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());
  db().prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(sha(token), userId, expiresAt.toISOString(), now());
  return { token, expiresAt };
}

/** Ends every session of a user (role change, compromise, "sign out everywhere"). */
export function deleteUserSessions(userId: string) {
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
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

export class AddressLimitError extends Error {}

export function addAddress(userId: string, input: AddressInput, makeDefault: boolean): Address {
  const id = newId();
  const run = db().transaction(() => {
    const count = (db().prepare("SELECT COUNT(*) c FROM addresses WHERE user_id = ?").get(userId) as { c: number }).c;
    if (count >= MAX_ADDRESSES) throw new AddressLimitError();
    const isDefault = makeDefault || count === 0;
    if (isDefault) db().prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").run(userId);
    db()
      .prepare(
        `INSERT INTO addresses (id, user_id, label, recipient, mobile, province, city, street, plaque, unit, postal_code, is_default, created_at)
         VALUES (@id, @userId, @label, @recipient, @mobile, @province, @city, @street, @plaque, @unit, @postalCode, @isDefault, @createdAt)`,
      )
      .run({ id, userId, ...input, isDefault: isDefault ? 1 : 0, createdAt: now() });
  });
  run();
  return getAddress(userId, id)!;
}

export function deleteAddress(userId: string, id: string) {
  const run = db().transaction(() => {
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
  run();
}

export function setDefaultAddress(userId: string, id: string) {
  const run = db().transaction(() => {
    db().prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").run(userId);
    db().prepare("UPDATE addresses SET is_default = 1 WHERE user_id = ? AND id = ?").run(userId, id);
  });
  run();
}

// ── staff roles ──

export function listStaff(): { mobile: string; role: StaffRole; grantedBy: string; grantedAt: string; name: string | null }[] {
  return (
    db()
      .prepare("SELECT s.mobile, s.role, s.granted_by, s.granted_at, u.name FROM staff_roles s LEFT JOIN users u ON u.mobile = s.mobile ORDER BY s.mobile, s.role")
      .all() as { mobile: string; role: StaffRole; granted_by: string; granted_at: string; name: string | null }[]
  ).map((r) => ({ mobile: r.mobile, role: r.role, grantedBy: r.granted_by, grantedAt: r.granted_at, name: r.name }));
}

/** Changes staff roles and ends that person's sessions so new privileges apply on next login. */
export function setStaffRole(mobile: string, role: StaffRole, granted: boolean, actor: string) {
  tx(() => {
    if (granted) {
      db().prepare("INSERT OR IGNORE INTO staff_roles (mobile, role, granted_by, granted_at) VALUES (?, ?, ?, ?)").run(mobile, role, actor, now());
    } else {
      const admins = db().prepare("SELECT COUNT(*) c FROM staff_roles WHERE role = 'admin'").get() as { c: number };
      if (role === "admin" && admins.c <= 1) throw new Error("cannot remove the last admin");
      db().prepare("DELETE FROM staff_roles WHERE mobile = ? AND role = ?").run(mobile, role);
    }
    const u = db().prepare("SELECT id FROM users WHERE mobile = ?").get(mobile) as { id: string } | undefined;
    if (u) deleteUserSessions(u.id);
    db()
      .prepare("INSERT INTO audit_log (actor, action, entity, entity_id, before, after, created_at) VALUES (?, ?, 'staff_role', ?, NULL, ?, ?)")
      .run(actor, granted ? "staff.grant" : "staff.revoke", mobile, JSON.stringify({ role }), now());
  });
}
