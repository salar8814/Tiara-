import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, isStaff, type Permission } from "./authz";
import { secureCookies } from "./config";
import type { User } from "./types";
import { createSession, deleteSession, userForSession } from "./repo/users";

const COOKIE = "tiara_session";

/** The only source of identity: the httpOnly session cookie, resolved against the DB on every request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token || token.length > 128) return null;
  return userForSession(token);
});

/** Rotates the session: any session already bound to this browser is destroyed first. */
export async function startSession(userId: string) {
  const jar = await cookies();
  const previous = jar.get(COOKIE)?.value;
  if (previous) deleteSession(previous);
  const { token, expiresAt } = createSession(userId);
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) deleteSession(token);
  jar.delete(COOKIE);
}

export async function requireUser(next: string): Promise<User> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/** Page guard for the staff area. Server actions additionally check a specific permission. */
export async function requireStaff(permission?: Permission): Promise<User> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (!isStaff(u)) redirect("/account?denied=admin");
  if (permission && !can(u, permission)) redirect("/admin?denied=1");
  return u;
}

/**
 * Internal redirect target only. Rejects absolute URLs, protocol-relative
 * URLs, backslashes (browsers treat `\` as `/`) and control characters.
 */
export function safeNext(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const base = "http://internal.invalid";
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
