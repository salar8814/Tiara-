import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type { Rfq, User } from "./types";

// Guests can submit RFQs without an account. Access to a request page is
// granted by (a) owning account, (b) admin role, or (c) a signed cookie
// issued after submitting the request or passing the code + phone check.

const COOKIE = "tiara_rfq_access";

function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const row = db().prepare("SELECT value FROM meta WHERE key = 'access_secret'").get() as { value: string } | undefined;
  if (row) return row.value;
  const v = randomBytes(32).toString("hex");
  db().prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('access_secret', ?)").run(v);
  return (db().prepare("SELECT value FROM meta WHERE key = 'access_secret'").get() as { value: string }).value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

async function readCodes(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return [];
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return [];
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as string[];
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
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function canAccessRfq(rfq: Rfq, user: User | null): Promise<boolean> {
  if (user?.role === "admin") return true;
  if (user && rfq.userId === user.id) return true;
  return (await readCodes()).includes(rfq.code);
}

export async function guestRfqCodes() {
  return readCodes();
}
