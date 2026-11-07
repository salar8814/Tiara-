import "server-only";
import { db, now } from "../db";

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

/** Append-only (enforced by triggers). Call inside the same transaction as the change it records. */
export function audit(actor: string, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
  db()
    .prepare("INSERT INTO audit_log (actor, action, entity, entity_id, before, after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(actor, action, entity, entityId, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after), now());
}

export function listAudit(opts: { entity?: string; entityId?: string; limit?: number } = {}): AuditEntry[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.entity) { where.push("entity = ?"); args.push(opts.entity); }
  if (opts.entityId) { where.push("entity_id = ?"); args.push(opts.entityId); }
  args.push(opts.limit ?? 200);
  const rows = db()
    .prepare(`SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`)
    .all(...args) as { id: number; actor: string; action: string; entity: string; entity_id: string; before: string | null; after: string | null; created_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    before: r.before ? JSON.parse(r.before) : null,
    after: r.after ? JSON.parse(r.after) : null,
    createdAt: r.created_at,
  }));
}
