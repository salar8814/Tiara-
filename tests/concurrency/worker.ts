// Child process for tests/integration/concurrency.test.ts.
// argv: <mode> <startAtMs> [...]
//   expire          — call expireStaleOrders() in a tight loop (fixed code)
//   expire-baseline — run the baseline (d10c915) expiry algorithm, for comparison
//   buy <variantId> <n> <mobile> — attempt n single-unit purchases
import Database from "better-sqlite3";
import { createOrder, expireStaleOrders } from "@/lib/repo/orders";
import { upsertUserOnLogin } from "@/lib/repo/users";

const [mode, startAt, ...rest] = process.argv.slice(2);
while (Date.now() < Number(startAt)) { /* barrier: start all processes together */ }

let ok = 0;
let failed = 0;
if (mode === "expire") {
  for (let i = 0; i < 50; i++) ok += expireStaleOrders();
} else if (mode === "expire-baseline") {
  const db = new Database(process.env.DATABASE_PATH!);
  db.pragma("busy_timeout = 5000");
  for (let i = 0; i < 50; i++) {
    // identical statements to d10c915 expireStaleOrders(): stale list read OUTSIDE the transaction,
    // DEFERRED transaction, UPDATE without a status guard.
    const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
    const stale = db.prepare("SELECT id FROM orders WHERE status = 'pending_payment' AND created_at < ?").all(cutoff) as { id: string }[];
    if (!stale.length) continue;
    try {
      db.transaction(() => {
        for (const s of stale) {
          for (const it of db.prepare("SELECT variant_id, qty FROM order_items WHERE order_id = ?").all(s.id) as { variant_id: string; qty: number }[])
            db.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?").run(it.qty, it.variant_id);
          db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(s.id);
          ok++;
        }
      })();
    } catch {
      failed++;
    }
  }
} else if (mode === "buy") {
  const [variantId, n, mobile] = rest;
  const user = upsertUserOnLogin(mobile);
  for (let i = 0; i < Number(n); i++) {
    try {
      createOrder({ user, lines: [{ variantId, qty: 1 }], deliveryMethod: "workplace", address: null, paymentMethod: "gateway" });
      ok++;
    } catch {
      failed++;
    }
  }
}
process.stdout.write(JSON.stringify({ ok, failed }));
