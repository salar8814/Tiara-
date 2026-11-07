import "server-only";
import { db } from "./db";

// Fixed-window counters persisted in SQLite, so limits hold across restarts.
// Single-process deployment only (ADR-002); move to Redis/PostgreSQL with the DB.

export interface Limit {
  /** max events per window */
  max: number;
  windowSec: number;
}

export type LimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

/** Count one event for `key`. Returns ok=false (without counting) once the window is full. */
export function hit(key: string, limit: Limit, nowMs = Date.now()): LimitResult {
  return db().transaction((): LimitResult => {
    const windowStart = Math.floor(nowMs / 1000 / limit.windowSec) * limit.windowSec;
    const row = db().prepare("SELECT window_start, count FROM rate_limits WHERE key = ?").get(key) as { window_start: number; count: number } | undefined;
    const count = row && row.window_start === windowStart ? row.count : 0;
    if (count >= limit.max) return { ok: false, retryAfterSec: windowStart + limit.windowSec - Math.floor(nowMs / 1000) };
    db()
      .prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count")
      .run(key, windowStart, count + 1);
    return { ok: true, remaining: limit.max - count - 1 };
  }).immediate();
}

/** Read-only check: would the next event be allowed? */
export function peek(key: string, limit: Limit, nowMs = Date.now()): boolean {
  const windowStart = Math.floor(nowMs / 1000 / limit.windowSec) * limit.windowSec;
  const row = db().prepare("SELECT window_start, count FROM rate_limits WHERE key = ?").get(key) as { window_start: number; count: number } | undefined;
  return !(row && row.window_start === windowStart && row.count >= limit.max);
}

export const limits = {
  otpIssuePerMobile: { max: 5, windowSec: 3600 },
  otpIssuePerIp: { max: 20, windowSec: 3600 },
  /** wrong OTP guesses per mobile per day, across all issued codes */
  otpFailuresPerMobile: { max: 10, windowSec: 86_400 },
  otpVerifyPerIp: { max: 60, windowSec: 3600 },
  rfqSubmitPerIp: { max: 10, windowSec: 3600 },
  meetingPerIp: { max: 5, windowSec: 3600 },
  trackPerIp: { max: 20, windowSec: 900 },
} satisfies Record<string, Limit>;
