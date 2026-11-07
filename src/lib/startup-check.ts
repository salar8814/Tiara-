import { configuredSecret, otpMode, paymentMode, tiaraEnv } from "./config";

/**
 * A misconfigured production deployment refuses to start — and exits non-zero so
 * the supervisor surfaces it — instead of serving errors or running a demo mode.
 */
export function assertStartupConfig() {
  try {
    const env = tiaraEnv();
    configuredSecret(); // required and ≥32 chars in production
    const otp = otpMode(); // OTP_MODE=display refused in production
    const pay = paymentMode(); // PAYMENT_MODE=sandbox refused in production
    console.info(`[tiara] environment=${env} otp=${otp} payment=${pay}`);
  } catch (e) {
    console.error(`[tiara] refusing to start: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
