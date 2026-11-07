// Real multi-process concurrency: N separate Node processes, each with its own
// SQLite connection, run the actual repository code against one database file.
import { spawn } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { reconcile } from "@/lib/repo/inventory";
import { createOrder } from "@/lib/repo/orders";
import { upsertUserOnLogin } from "@/lib/repo/users";
import { ageOrder, setStockViaLedger, stockOf } from "../helpers";

const root = path.resolve(import.meta.dirname, "../..");

function runWorkers(n: number, args: string[]): Promise<{ ok: number; failed: number }[]> {
  const startAt = String(Date.now() + 1500); // all processes start their loop at the same instant
  return Promise.all(
    Array.from({ length: n }, () => new Promise<{ ok: number; failed: number }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--experimental-transform-types", "--no-warnings", "--import", "./tests/concurrency/register.mjs", "tests/concurrency/worker.ts", args[0], startAt, ...args.slice(1)],
        { cwd: root, env: { ...process.env, TIARA_ENV: "test" } },
      );
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("exit", (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`worker exited ${code}: ${err}`))));
    })),
  );
}

describe("concurrency (4 OS processes, one database file)", () => {
  it("concurrent expiry releases each stale order's stock exactly once", async () => {
    const V = "v-moramora-lip";
    setStockViaLedger(V, 200);
    const user = upsertUserOnLogin("09121111111");
    const ids: string[] = [];
    for (let i = 0; i < 200; i++) {
      const o = createOrder({ user, lines: [{ variantId: V, qty: 1 }], deliveryMethod: "workplace", address: null, paymentMethod: "gateway" });
      ids.push(o.id);
    }
    expect(stockOf(V)).toBe(0);
    for (const id of ids) ageOrder(id, 45);

    const results = await runWorkers(4, ["expire"]);

    const released = results.reduce((s, r) => s + r.ok, 0);
    expect(released).toBe(200); // exactly one process won each order
    expect(stockOf(V)).toBe(200); // no phantom units
    expect(reconcile()).toEqual([]);
    const releases = db().prepare("SELECT COUNT(*) c FROM inventory_movements WHERE variant_id = ? AND reason = 'release'").get(V) as { c: number };
    expect(releases.c).toBe(200);
    const cancelled = db().prepare(`SELECT COUNT(*) c FROM orders WHERE status = 'cancelled' AND id IN (${ids.map(() => "?").join(",")})`).get(...ids) as { c: number };
    expect(cancelled.c).toBe(200);
  }, 60_000);

  it("concurrent purchases never oversell the last units", async () => {
    const V = "v-screen-500";
    setStockViaLedger(V, 20);
    const results = await runWorkers(4, ["buy", V, "10", "09122222222"]);
    const sold = results.reduce((s, r) => s + r.ok, 0);
    const refused = results.reduce((s, r) => s + r.failed, 0);
    expect(sold).toBe(20);
    expect(refused).toBe(20);
    expect(stockOf(V)).toBe(0);
    expect(reconcile()).toEqual([]);
  }, 60_000);
});
