import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { can } from "./authz";
import { configuredSecret, secureCookies } from "./config";
import { db } from "./db";
import type { Rfq, User } from "./types";

// Guests can submit RFQs without an account. READ access to a request page is
// granted by (a) owning account, (b) sales/finance staff, or (c) a signed cookie
// issued after submitting the request or passing the rate-limited code + phone
// check. DECISIONS (approving a quotation) require an OTP-verified owner — see
// canDecideRfq — because code + phone is not proof of identity.

const COOKIE = "tiara_rfq_access";

function secret(): string {
  const configured = configuredSecret(); // throws in production when unset
  if (configured) return configured;
  const row = db().prepare("SELECT value FROM meta WHERE key = 'access_secret'").get() as { value: string } | undefined;
  if (row) return row.value;
  db().prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('access_secret', ?)").run(randomBytes(32).toString("hex"));
  return (db().prepare("SELECT value FROM meta WHERE key = 'access_secret'").get() as { value: string }).value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

async function readCodes(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || raw.length > 4096) return [];
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return [];
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return [];
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as unknown;
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export async function grantRfqAccess(code: string) {
  const codes = Array.from(new Set([code, ...(await readCodes())])).slice(0, 20);
  const payload = Buffer.from(JSON.stringify(codes)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

/** Pure rule, unit-tested: may this viewer read the RFQ? */
export function rfqReadAllowed(rfq: Rfq, user: User | null, cookieCodes: string[]): boolean {
  if (can(user, "rfq.manage") || can(user, "corporate_orders.confirm")) return true;
  if (user && rfq.userId === user.id) return true;
  return cookieCodes.includes(rfq.code);
}

/** Pure rule, unit-tested: may this viewer approve/decline the RFQ's quotation? */
export function canDecideRfq(rfq: Rfq, user: User | null): boolean {
  return !!user && rfq.userId === user.id;
}

export async function canAccessRfq(rfq: Rfq, user: User | null): Promise<boolean> {
  return rfqReadAllowed(rfq, user, await readCodes());
}

export async function guestRfqCodes() {
  return readCodes();
}
