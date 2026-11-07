import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// E2E runs the production build against a throw-away database in TIARA_ENV=test,
// with on-screen OTP and the payment sandbox (both refused in production).
const port = Number(process.env.E2E_PORT ?? 3200);
const dbPath = path.join(os.tmpdir(), `tiara-e2e-${process.pid}-${Date.now()}.db`);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${port}`, locale: "fa-IR", trace: "retain-on-failure" },
  webServer: {
    command: `npx next start -p ${port} -H 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      TIARA_ENV: "test",
      OTP_MODE: "display",
      PAYMENT_MODE: "sandbox",
      DATABASE_PATH: dbPath,
      SESSION_SECRET: "e2e-only-secret-not-used-anywhere-else-000",
    },
  },
});
