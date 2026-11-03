import "server-only";
import { randomInt } from "node:crypto";
import { db, now } from "../db";
import { isoToJalali } from "../jalali";
import { tehranIsoDate } from "../format";
import type { TimelineEvent } from "../types";

export type Entity = "order" | "rfq" | "corporate_order" | "meeting";

export function addEvent(entity: Entity, entityId: string, status: string, note: string | null, actor: string) {
  db()
    .prepare("INSERT INTO events (entity, entity_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(entity, entityId, status, note, actor, now());
}

export function listEvents(entity: Entity, entityId: string): TimelineEvent[] {
  return (
    db()
      .prepare("SELECT status, note, actor, created_at FROM events WHERE entity = ? AND entity_id = ? ORDER BY created_at, rowid")
      .all(entity, entityId) as { status: string; note: string | null; actor: string; created_at: string }[]
  ).map((r) => ({ status: r.status, note: r.note, actor: r.actor, createdAt: r.created_at }));
}

/** Human-friendly unique code, e.g. RFQ-1405-48271 (Jalali year). */
export function uniqueCode(prefix: string, table: string, column = "code"): string {
  const { jy } = isoToJalali(tehranIsoDate());
  for (let i = 0; i < 20; i++) {
    const code = `${prefix}-${jy}-${randomInt(10000, 99999)}`;
    const hit = db().prepare(`SELECT 1 FROM ${table} WHERE ${column} = ?`).get(code);
    if (!hit) return code;
  }
  throw new Error("could not allocate code");
}
