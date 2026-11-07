# Architecture decision records

## ADR-001: Service layer between server actions and repositories

- **Status:** accepted.
- **Context:** at baseline, the permission checks for admin actions were inline and amounted to "is admin". That made them hard to test, because actions need a Next request context.
- **Decision:**
  - `src/lib/services/*` functions take the **actor** (resolved from the session cookie) and do three things: check a specific permission, validate input, and call the guarded repository functions, writing the audit record in the same transaction.
  - Server actions only parse form data and map errors to messages.
- **Consequences:** authorization is testable without HTTP (`tests/integration/authz-services.test.ts`). Adding an admin operation without an `assertCan` call would be visible in review, since the service file is the only place that calls privileged repository writes. That is enforced by convention, not by the compiler.

## ADR-002: Keep SQLite for now — single process per database file

- **Status:** accepted, with explicit migration triggers.
- **Context:** the prompt asked whether SQLite is still appropriate. Measured facts from this codebase:
  - With WAL and `BEGIN IMMEDIATE`, four concurrent OS processes on one file produced correct results in `concurrency.test.ts`: 200 contended expiries and 40 contended purchases.
  - The baseline algorithm, under the same harness, corrupted stock in 4 of 5 trials.

  Correctness under multiple processes therefore depends on the guarded-UPDATE discipline (ADR-003), not on SQLite itself.
- **Not measured:** throughput, latency under load, and the time taken by the `busy_timeout` wait. **No scalability claim is made.**
- **Decision:**
  - Production runs **one** `next start` process per database file, on a persistent volume.
  - The rate-limit counters live in the same database.
- **Why not migrate now:**
  - There is no production traffic yet and no measured bottleneck.
  - A PostgreSQL port touches every repository module: about 2,150 lines of data-access code and 130 prepared statements (measured with `wc -l` and `grep -c "prepare("`). Doing that in the same change as the security fixes would have made both unverifiable.
- **Migration triggers.** Move to PostgreSQL before any of these:
  1. More than one application instance, for availability or blue/green deploys.
  2. A separate worker process (cron, queue consumer, payment-provider webhook handler) that writes to orders or stock. This is safe today because of ADR-003, but it shares one file lock.
  3. Expiry or reconciliation needs to run on a schedule rather than lazily.
  4. Any measured p95 write latency at or above 100 ms, or `SQLITE_BUSY` errors in logs.
  5. A requirement for point-in-time recovery beyond file snapshots.
- **Migration strategy:**
  1. Port `src/lib/migrations.ts` to SQL files and use node-postgres (`pg`).
  2. Map the triggers to CHECK constraints or enums.
  3. Map `json_each` to `jsonb` operators, and `RETURNING` and `ON CONFLICT` as they are (both native).
  4. Map `BEGIN IMMEDIATE` to `BEGIN` plus `SELECT … FOR UPDATE` on the order or variant row. The guarded `UPDATE … WHERE status = ?` pattern carries over unchanged.
  5. Move rate limits to Redis or a Postgres table with `ON CONFLICT`.
  6. Run the existing integration suite against Postgres; it is DB-agnostic except for `tests/helpers.ts`.
  7. Copy the data, using the inventory ledger to verify stock totals after the copy.
- **Backup (current model):** run SQLite `VACUUM INTO` or `.backup` on a schedule, keeping the WAL with the file. Restore is a file copy followed by `reconcile()`, which must return an empty result.

## ADR-003: Concurrency through conditional updates and an inventory ledger

- **Status:** accepted.
- **Decision:**
  - Every state transition is `UPDATE … SET status = :to WHERE id = :id AND status IN (:expected)`, run in `BEGIN IMMEDIATE` (`tx()` in `src/lib/db.ts`).
  - Side effects (stock release, events, audit) run **only** when `changes === 1`.
  - Stock changes are only `UPDATE variants SET stock = stock + :delta WHERE id = :id AND stock + :delta >= 0 RETURNING stock`, plus an append-only `inventory_movements` row.
- **Consequences:**
  - Losing a race is a no-op, never a double effect.
  - `reconcile()` proves `stock == SUM(movements)` and is shown in the admin UI.
  - Deadlocks are impossible: there is one writer at a time in SQLite, and only single-row updates in the Postgres design.

## ADR-004: Staff roles and separation of duties

- **Status:** accepted. The role split itself is a business proposal and needs sign-off.
- **Decision:**
  - Four roles, stored in `staff_roles`, keyed by mobile so they can be granted before first login: `admin`, `sales`, `finance`, `warehouse`.
  - The permission map lives in `src/lib/authz.ts`.
  - Money operations are restricted to finance: recording payments and refunds, cancelling paid orders, and confirming corporate orders against a PO.
  - Stock is restricted to warehouse: adjustments and fulfilment.
  - Prices and catalog are restricted to admin.
  - Sales can't move money, and finance can't move stock.
- **Bootstrap:** `npm run staff:grant` (CLI, audited) for the first admin; after that, `/admin/staff`.
- **Open question:** whether finance should also be allowed to adjust prices, and whether sales may record approvals on a customer's behalf. Neither is implemented.

## ADR-005: Environment gating of demo features

- **Status:** accepted.
- **Decision:**
  - `TIARA_ENV` (`development`, `test`, `staging` or `production`) gates the demo HR directory, demo staff, on-screen OTP and the payment sandbox.
  - When it is unset, it is derived from `NODE_ENV`, so a plain `next start` counts as production.
  - In production, demo flags cause a **startup refusal** with exit code 1 (`src/instrumentation.ts`, then `src/lib/startup-check.ts`), not a silent fallback.
- **Consequence:** a production deployment with no SMS provider can't log anyone in, which is correct. Integrations must be built before go-live; nothing can be "temporarily demo'd" in production.

## ADR-006: Approval requires an OTP-verified identity

- **Status:** accepted.
- **Decision:** code + phone grants **read** access to an RFQ. Approving or declining a quotation, which is a financial commitment, requires the signed-in owner. Guest RFQs are attached to an account when the same mobile logs in with OTP.
- **Consequence:** contacts who gave a landline can't approve online. Sales needs an "approval received offline" action with evidence attached; it is not implemented (see PRODUCTION_READINESS).

## ADR-007: Testing strategy

- **Unit tests:** pure rules (pricing, B2B quantities, the permission matrix, config gating, redirects).
- **Integration tests:** the real repositories and services against a temporary SQLite file per test file (`tests/setup.ts`). No mocks of business logic.
- **Concurrency tests:** four real Node processes running the same TypeScript code through a small resolve hook (`tests/concurrency/register.mjs`).
- **E2E:** Playwright against `next build` and `next start`, with a throw-away DB. Every test fails on browser errors.
- **Mutation spot-check:** re-introducing three baseline defects makes the suite fail (`docs/evidence/mutation-check.txt`).
