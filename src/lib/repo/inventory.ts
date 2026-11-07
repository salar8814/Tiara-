import "server-only";
import { db, now } from "../db";

// The ONLY code that changes variants.stock. Every change is a single
// conditional UPDATE (atomic in SQLite) plus an append-only ledger row, so:
//   • stock can never go negative (WHERE stock + delta >= 0 and CHECK constraint)
//   • stock is always reconcilable: stock == SUM(inventory_movements.delta)
// Callers that combine several moves must wrap them in tx().

export type MoveReason = "reserve" | "release" | "adjust";

export class InsufficientStockError extends Error {
  constructor(public variantId: string) {
    super(`insufficient stock for ${variantId}`);
  }
}

export function moveStock(variantId: string, delta: number, reason: MoveReason, actor: string, ref: string | null, note: string | null = null): number {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("delta must be a non-zero integer");
  const row = db()
    .prepare("UPDATE variants SET stock = stock + ? WHERE id = ? AND stock + ? >= 0 RETURNING stock")
    .get(delta, variantId, delta) as { stock: number } | undefined;
  if (!row) throw new InsufficientStockError(variantId);
  db()
    .prepare("INSERT INTO inventory_movements (variant_id, delta, reason, ref, note, actor, stock_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(variantId, delta, reason, ref, note, actor, row.stock, now());
  return row.stock;
}

export interface Movement {
  id: number;
  variantId: string;
  delta: number;
  reason: string;
  ref: string | null;
  note: string | null;
  actor: string;
  stockAfter: number;
  createdAt: string;
}

export function listMovements(variantId?: string, limit = 100): Movement[] {
  const rows = (
    variantId
      ? db().prepare("SELECT * FROM inventory_movements WHERE variant_id = ? ORDER BY id DESC LIMIT ?").all(variantId, limit)
      : db().prepare("SELECT * FROM inventory_movements ORDER BY id DESC LIMIT ?").all(limit)
  ) as { id: number; variant_id: string; delta: number; reason: string; ref: string | null; note: string | null; actor: string; stock_after: number; created_at: string }[];
  return rows.map((r) => ({ id: r.id, variantId: r.variant_id, delta: r.delta, reason: r.reason, ref: r.ref, note: r.note, actor: r.actor, stockAfter: r.stock_after, createdAt: r.created_at }));
}

/** Variants whose stock differs from their ledger — should always be empty. */
export function reconcile(): { variantId: string; stock: number; ledger: number }[] {
  return db()
    .prepare(
      `SELECT v.id AS variantId, v.stock AS stock, COALESCE(SUM(m.delta), 0) AS ledger
       FROM variants v LEFT JOIN inventory_movements m ON m.variant_id = v.id
       GROUP BY v.id HAVING v.stock <> COALESCE(SUM(m.delta), 0)`,
    )
    .all() as { variantId: string; stock: number; ledger: number }[];
}
