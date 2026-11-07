import { afterEach, describe, expect, it } from "vitest";
import { rfqReadAllowed, canDecideRfq } from "@/lib/access";
import { can, type Permission } from "@/lib/authz";
import { ConfigError, configuredSecret, otpMode, paymentMode, tiaraEnv } from "@/lib/config";
import { safeNext } from "@/lib/session";
import type { Rfq, StaffRole, User } from "@/lib/types";

const user = (roles: StaffRole[], id = "u1"): User => ({
  id, mobile: "09120001111", name: null, role: "employee", eligibility: "eligible", employeeCode: null, unit: null, company: null, staffRoles: roles, createdAt: "",
});

describe("separation of duties", () => {
  const matrix: [Permission, StaffRole[]][] = [
    ["catalog.edit", ["admin"]],
    ["inventory.adjust", ["admin", "warehouse"]],
    ["orders.fulfil", ["admin", "warehouse"]],
    ["orders.cancel_paid", ["admin", "finance"]],
    ["payments.record", ["admin", "finance"]],
    ["refunds.record", ["admin", "finance"]],
    ["quotes.issue", ["admin", "sales"]],
    ["corporate_orders.confirm", ["admin", "finance"]],
    ["corporate_orders.fulfil", ["admin", "warehouse"]],
    ["staff.manage", ["admin"]],
    ["audit.view", ["admin"]],
  ];
  for (const [perm, allowed] of matrix) {
    it(perm, () => {
      for (const r of ["admin", "sales", "finance", "warehouse"] as StaffRole[]) expect(can(user([r]), perm)).toBe(allowed.includes(r));
      expect(can(user([]), perm)).toBe(false); // ordinary employee
      expect(can(null, perm)).toBe(false); // anonymous
    });
  }
});

describe("RFQ access rules", () => {
  const rfq = { code: "RFQ-1405-12345", userId: "owner" } as Rfq;
  it("owner, staff and cookie holders may read; nobody else", () => {
    expect(rfqReadAllowed(rfq, user([], "owner"), [])).toBe(true);
    expect(rfqReadAllowed(rfq, user(["sales"], "x"), [])).toBe(true);
    expect(rfqReadAllowed(rfq, null, ["RFQ-1405-12345"])).toBe(true);
    expect(rfqReadAllowed(rfq, user([], "other"), [])).toBe(false);
    expect(rfqReadAllowed(rfq, null, ["RFQ-1405-99999"])).toBe(false);
    expect(rfqReadAllowed(rfq, user(["warehouse"], "x"), [])).toBe(false);
  });
  it("only the signed-in owner may approve — not cookie holders, not staff", () => {
    expect(canDecideRfq(rfq, user([], "owner"))).toBe(true);
    expect(canDecideRfq(rfq, null)).toBe(false);
    expect(canDecideRfq(rfq, user(["admin"], "x"))).toBe(false);
    expect(canDecideRfq({ ...rfq, userId: null }, user([], "owner"))).toBe(false);
  });
});

describe("safeNext (open redirect)", () => {
  it.each(["/\\evil.example", "//evil.example", "https://evil.example", "javascript:alert(1)", "/a\u0000b", "", "x".repeat(600)])("rejects %j", (v) => {
    expect(safeNext(v)).toBe("/account");
  });
  it("keeps internal paths with query", () => {
    expect(safeNext("/corporate/requests/RFQ-1?x=1")).toBe("/corporate/requests/RFQ-1?x=1");
  });
});

describe("environment gating of demo features", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  const prod = () => {
    process.env.TIARA_ENV = "production";
  };

  it("production refuses OTP display mode and sandbox payment even when requested", () => {
    prod();
    process.env.OTP_MODE = "display";
    expect(() => otpMode()).toThrow(ConfigError);
    process.env.PAYMENT_MODE = "sandbox";
    expect(() => paymentMode()).toThrow(ConfigError);
  });

  it("production defaults are fail-closed", () => {
    prod();
    delete process.env.OTP_MODE;
    delete process.env.PAYMENT_MODE;
    expect(otpMode()).toBe("disabled");
    expect(paymentMode()).toBe("disabled");
  });

  it("NODE_ENV=production without TIARA_ENV is treated as production", () => {
    delete process.env.TIARA_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(tiaraEnv()).toBe("production");
    process.env.OTP_MODE = "display";
    expect(() => otpMode()).toThrow(ConfigError);
  });

  it("production requires a strong SESSION_SECRET", () => {
    prod();
    delete process.env.SESSION_SECRET;
    expect(() => configuredSecret()).toThrow(ConfigError);
    process.env.SESSION_SECRET = "short";
    expect(() => configuredSecret()).toThrow(ConfigError);
    process.env.SESSION_SECRET = "x".repeat(40);
    expect(configuredSecret()).toHaveLength(40);
  });

  it("rejects unknown modes instead of guessing", () => {
    process.env.TIARA_ENV = "staging";
    process.env.PAYMENT_MODE = "live";
    expect(() => paymentMode()).toThrow(ConfigError);
    process.env.TIARA_ENV = "prod";
    expect(() => tiaraEnv()).toThrow(ConfigError);
  });
});
