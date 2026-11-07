// Runs in its own process with TIARA_ENV=production *before* the database opens.
import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";

process.env.TIARA_ENV = "production";
process.env.SESSION_SECRET = "p".repeat(48);
delete process.env.OTP_MODE;
delete process.env.PAYMENT_MODE;

describe("production environment", () => {
  it("B-10: no demo HR records and no demo staff are seeded", async () => {
    const { db } = await import("@/lib/db");
    expect((db().prepare("SELECT COUNT(*) c FROM hr_directory").get() as { c: number }).c).toBe(0);
    expect((db().prepare("SELECT COUNT(*) c FROM staff_roles").get() as { c: number }).c).toBe(0);
    // catalog (real product data) is still seeded
    expect((db().prepare("SELECT COUNT(*) c FROM products").get() as { c: number }).c).toBeGreaterThan(0);
  });

  it("demo numbers get no employee pricing and no staff access", async () => {
    const { upsertUserOnLogin } = await import("@/lib/repo/users");
    const { can } = await import("@/lib/authz");
    const former = upsertUserOnLogin("09120000000"); // the demo admin number
    expect(former.eligibility).toBe("not_employee");
    expect(former.staffRoles).toEqual([]);
    expect(can(former, "catalog.edit")).toBe(false);
  });

  it("OTP and payment are disabled by default; demo modes cannot be switched on", async () => {
    const { otpMode, paymentMode, ConfigError } = await import("@/lib/config");
    expect(otpMode()).toBe("disabled");
    expect(paymentMode()).toBe("disabled");
    vi.stubEnv("OTP_MODE", "display");
    expect(() => otpMode()).toThrow(ConfigError);
    vi.stubEnv("PAYMENT_MODE", "sandbox");
    expect(() => paymentMode()).toThrow(ConfigError);
    vi.unstubAllEnvs();
  });

  it("refuses to open a production database that contains demo records", async () => {
    const { db } = await import("@/lib/db");
    const file = process.env.DATABASE_PATH!;
    db().close();
    const raw = new Database(file);
    raw.prepare("INSERT INTO hr_directory (mobile, name, employee_code, unit, company, status, admin) VALUES ('09121111111','x','1','x','x','active',0)").run();
    raw.close();
    (globalThis as { __tiaraDb?: unknown }).__tiaraDb = undefined;
    expect(() => db()).toThrow(/Demo HR records/);
  });
});
