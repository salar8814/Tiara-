import { db } from "@/lib/db";
import { moveStock } from "@/lib/repo/inventory";
import type { StaffRole, User } from "@/lib/types";
import { getUser, upsertUserOnLogin } from "@/lib/repo/users";

/** Moves an order's creation time into the past so lazy expiry treats it as stale. */
export function ageOrder(orderId: string, minutes: number) {
  const ts = new Date(Date.now() - minutes * 60_000).toISOString();
  db().prepare("UPDATE orders SET created_at = ? WHERE id = ?").run(ts, orderId);
}

export function stockOf(variantId: string): number {
  return (db().prepare("SELECT stock FROM variants WHERE id = ?").get(variantId) as { stock: number }).stock;
}

/** Sets stock through the ledger (keeps stock == SUM(movements)). */
export function setStockViaLedger(variantId: string, target: number) {
  const delta = target - stockOf(variantId);
  if (delta !== 0) moveStock(variantId, delta, "adjust", "test", null, "test setup");
}

/** A signed-in user with the given staff roles (roles keyed by mobile, as in production). */
export function staffUser(mobile: string, roles: StaffRole[]): User {
  const u = upsertUserOnLogin(mobile);
  db().prepare("DELETE FROM staff_roles WHERE mobile = ?").run(mobile);
  for (const r of roles) db().prepare("INSERT INTO staff_roles (mobile, role, granted_by, granted_at) VALUES (?, ?, 'test', ?)").run(mobile, r, new Date().toISOString());
  return getUser(u.id)!;
}

export const count = (sql: string, ...args: unknown[]) => (db().prepare(sql).get(...args) as { c: number }).c;
