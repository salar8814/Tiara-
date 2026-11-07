import "server-only";
import { headers } from "next/headers";
import { trustProxy } from "./config";

/**
 * Client IP for rate limiting. X-Forwarded-For is attacker-controlled unless a
 * trusted reverse proxy overwrites it, so it is used only with TRUST_PROXY=true.
 * Without it every client shares one bucket ("unknown"); callers widen limits
 * for that bucket (see ipLimit). Per-mobile/per-phone limits apply regardless.
 */
export async function clientIp(): Promise<string> {
  if (!trustProxy()) return "unknown";
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}

export function ipLimit<T extends { max: number; windowSec: number }>(ip: string, limit: T): T {
  return ip === "unknown" ? { ...limit, max: limit.max * 20 } : limit;
}
