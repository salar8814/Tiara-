import "server-only";

// Single source of truth for environment-dependent behaviour.
//
// TIARA_ENV decides whether *demo* features may exist at all:
//   development | test | staging  → demo features allowed when explicitly enabled
//   production                    → demo features are refused, even if their flags are set
// When TIARA_ENV is unset it is derived from NODE_ENV, so a plain `next start`
// (NODE_ENV=production) is treated as production and fails closed.

export type TiaraEnv = "development" | "test" | "staging" | "production";

export class ConfigError extends Error {}

export function tiaraEnv(): TiaraEnv {
  const v = process.env.TIARA_ENV;
  if (v === "development" || v === "test" || v === "staging" || v === "production") return v;
  if (v) throw new ConfigError(`TIARA_ENV must be development|test|staging|production, got "${v}"`);
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export const isProductionEnv = () => tiaraEnv() === "production";

/** Demo data (demo HR directory, demo staff) and demo modes are allowed only outside production. */
export const demoAllowed = () => !isProductionEnv();

export type OtpMode = "disabled" | "display";
export type PaymentMode = "disabled" | "sandbox";

/**
 * OTP_MODE=display puts the login code in the browser. It is refused in production:
 * the process throws on first use rather than silently showing codes.
 */
export function otpMode(): OtpMode {
  const v = process.env.OTP_MODE;
  if (v === "display") {
    if (!demoAllowed()) throw new ConfigError("OTP_MODE=display is not allowed when TIARA_ENV=production");
    return "display";
  }
  if (v && v !== "disabled") throw new ConfigError(`Unknown OTP_MODE "${v}"`);
  if (v === "disabled") return "disabled";
  return demoAllowed() && tiaraEnv() === "development" ? "display" : "disabled";
}

/** PAYMENT_MODE=sandbox simulates gateway results. Refused in production. */
export function paymentMode(): PaymentMode {
  const v = process.env.PAYMENT_MODE;
  if (v === "sandbox") {
    if (!demoAllowed()) throw new ConfigError("PAYMENT_MODE=sandbox is not allowed when TIARA_ENV=production");
    return "sandbox";
  }
  if (v && v !== "disabled") throw new ConfigError(`Unknown PAYMENT_MODE "${v}"`);
  if (v === "disabled") return "disabled";
  return tiaraEnv() === "development" ? "sandbox" : "disabled";
}

/** Secret for HMAC-signed cookies. Required in production; generated per database otherwise. */
export function configuredSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s && s.length < 32) throw new ConfigError("SESSION_SECRET must be at least 32 characters");
  if (!s && isProductionEnv()) throw new ConfigError("SESSION_SECRET is required when TIARA_ENV=production");
  return s ?? null;
}

/** Only trust X-Forwarded-For when explicitly deployed behind a proxy that sets it. */
export const trustProxy = () => process.env.TRUST_PROXY === "true";

export const secureCookies = () => tiaraEnv() === "production" || tiaraEnv() === "staging";
