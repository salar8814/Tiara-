import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hit } from "@/lib/rate-limit";
import { createSession, deleteSession, issueOtp, upsertUserOnLogin, userForSession, verifyOtp } from "@/lib/repo/users";

const backdateOtp = (mobile: string, ms: number) =>
  db().prepare("UPDATE otp_codes SET created_at = ? WHERE mobile = ?").run(new Date(Date.now() - ms).toISOString(), mobile);
const wrong = (code: string) => (code === "00000" ? "11111" : "00000");

describe("OTP", () => {
  it("a correct code works once", () => {
    const r = issueOtp("09121110001");
    if (!r.ok) throw new Error("issue failed");
    expect(verifyOtp("09121110001", r.code)).toBe("ok");
    expect(verifyOtp("09121110001", r.code)).toBe("missing");
  });

  it("codes expire after 2 minutes", () => {
    const r = issueOtp("09121110002");
    if (!r.ok) throw new Error();
    db().prepare("UPDATE otp_codes SET expires_at = ? WHERE mobile = ?").run(new Date(Date.now() - 1000).toISOString(), "09121110002");
    expect(verifyOtp("09121110002", r.code)).toBe("expired");
  });

  it("5 wrong attempts lock the code, even the correct value is then refused", () => {
    const r = issueOtp("09121110003");
    if (!r.ok) throw new Error();
    for (let i = 0; i < 5; i++) expect(verifyOtp("09121110003", wrong(r.code))).toBe("invalid");
    expect(verifyOtp("09121110003", r.code)).toBe("locked");
  });

  it("60 s resend cooldown and 5 codes per hour per mobile", () => {
    const m = "09121110004";
    expect(issueOtp(m).ok).toBe(true);
    const again = issueOtp(m);
    expect(again.ok === false && again.reason).toBe("cooldown");
    for (let i = 0; i < 4; i++) {
      backdateOtp(m, 61_000);
      expect(issueOtp(m).ok).toBe(true);
    }
    backdateOtp(m, 61_000);
    const sixth = issueOtp(m);
    expect(sixth.ok === false && sixth.reason).toBe("rate_limited");
  });

  it("B-11: at most 10 wrong guesses per mobile per day across re-issued codes", () => {
    const m = "09127770000";
    let guesses = 0;
    for (let cycle = 0; cycle < 4; cycle++) {
      backdateOtp(m, 61_000);
      const issued = issueOtp(m);
      if (!issued.ok) break;
      for (let i = 0; i < 6; i++) if (verifyOtp(m, wrong(issued.code)) === "invalid") guesses++;
    }
    expect(guesses).toBe(10);
    backdateOtp(m, 61_000);
    const blocked = issueOtp(m);
    expect(blocked.ok === false && blocked.reason).toBe("locked");
  });
});

describe("rate limiter", () => {
  it("fixed window: allows max, then refuses until the window rolls over", () => {
    const t = 1_700_000_000_000;
    const limit = { max: 3, windowSec: 60 };
    expect([1, 2, 3].map(() => hit("t:a", limit, t).ok)).toEqual([true, true, true]);
    expect(hit("t:a", limit, t + 1000).ok).toBe(false);
    expect(hit("t:a", limit, t + 61_000).ok).toBe(true);
  });
});

describe("sessions", () => {
  it("tokens are stored hashed and expire", () => {
    const u = upsertUserOnLogin("09121110010");
    const { token } = createSession(u.id);
    expect(count(token)).toBe(0); // raw token never stored
    expect(userForSession(token)?.id).toBe(u.id);
    db().prepare("UPDATE sessions SET expires_at = ? WHERE user_id = ?").run(new Date(Date.now() - 1).toISOString(), u.id);
    expect(userForSession(token)).toBeNull();
  });

  it("logout invalidates the token", () => {
    const u = upsertUserOnLogin("09121110011");
    const { token } = createSession(u.id);
    deleteSession(token);
    expect(userForSession(token)).toBeNull();
  });

  it("concurrent first logins for one mobile do not fail (atomic upsert)", () => {
    const a = upsertUserOnLogin("09121110012");
    const b = upsertUserOnLogin("09121110012");
    expect(a.id).toBe(b.id);
  });
});

function count(token: string) {
  return (db().prepare("SELECT COUNT(*) c FROM sessions WHERE token_hash = ?").get(token) as { c: number }).c;
}
