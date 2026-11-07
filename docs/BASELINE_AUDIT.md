# Baseline audit — commit `d10c915`

- **Scope:** branch `claude/tiara-b2b-b2c-commerce-ktq0o3`, HEAD `d10c9155c5a4bebf88f4b276167bac2ef569d010`; local HEAD and origin were identical when the audit started.
- **Method:**
  - Read every file under `src/` and `scripts/`, plus `package.json`, the lockfile, `next.config.ts` and `.env.example`.
  - Compared the result with the six-screen PDF «UI پیشنهادی بخش دنیای تیارا».
  - Wrote an executable reproduction suite against the unmodified code (`tests/integration/baseline-repro.test.ts`). Its output is saved in `docs/evidence/baseline-repro-d10c915.txt`, and **all 12 reproductions failed on the baseline**.

Severity: **C** = critical (money, stock or authentication can be corrupted or bypassed), **H** = high (blocks safe operation), **M** = medium, **L** = low.

## 1. What actually exists (verified in code)

| Area | Real status at baseline |
|---|---|
| Persistence | SQLite via better-sqlite3, created and seeded on first request. No migration mechanism: `SCHEMA_VERSION=1` and `CREATE TABLE IF NOT EXISTS` only. |
| Auth | Mobile OTP. Codes are hashed, with a 2-minute TTL, 5 attempts per code and a 60-second resend gap. Session token stored as SHA-256 in an `httpOnly` cookie. |
| Eligibility | `hr_directory` table, seeded **unconditionally** from `src/data/demo-directory.ts`. |
| Admin authz | A single `role = 'admin'` flag on `users`, derived from `hr_directory.admin`. Checked by `requireAdmin()` in the layout and in every admin action. There is no role separation. |
| B2C | Cart (`localStorage`), server-side price recomputation, atomic `stock >= ?` reservation, lazy 30-minute expiry. Sandbox or disabled payment. |
| B2B | RFQ, quotation (versioned), approval, pro forma, confirmed order. There are **no company accounts and no multi-buyer model**: RFQs belong to one user or are anonymous (guest). |
| Tests | `scripts/smoke-test.mjs` only: one linear Playwright script. |
| Lint | None configured; `next lint` was removed in Next 16. |
| Security headers | None, apart from `poweredByHeader: false`. |
| Dependencies | `npm audit` showed 0 vulnerabilities at baseline. |

**Compared with the PDF:** all six screens have equivalents (landing, store, cart and checkout, corporate catalog, meeting booking, confirmation). Payroll deduction, which the PDF showed as the default, is disabled because no integration exists. That was a documented choice, not a gap.

## 2. Findings

### B-01 (C) Expired orders can release stock twice
- **Where:** `src/lib/repo/orders.ts`, `expireStaleOrders()`.
- **Problem:** the list of stale order IDs is read **outside** the write transaction, and the transaction then restores stock and runs `UPDATE orders SET status='cancelled' WHERE id=?` **without re-checking the status**. Two processes that share the database can both read the same stale order; each one then restores its stock.
- **Evidence:** reproduction B-01, with two connections interleaved exactly as two processes would run: stock reached **12** from 10 after an order for 2 units expired.
- **Single-process note:** inside one Node process this window can't open, because better-sqlite3 calls are synchronous and nothing awaits between the SELECT and the transaction. It needs at least two processes on the same file: several `next start` instances, a separate cron worker, or a CLI script. The same unguarded pattern exists in `restoreStock` callers.
- **Impact:** phantom inventory, overselling, and stock figures that no longer match the warehouse.

### B-02 (C) Per-order cap bypass
- **Where:** `createOrder()`.
- **Problem:** each line is validated separately, so two lines for the same variant each pass `qty <= maxPerOrder`.
- **Evidence:** B-02, where 2 lines × 3 units were accepted with a cap of 3.
- **Impact:** an employee can buy more units at the discounted price than the cap allows.

### B-03 (C) An order can be marked paid without a payment
- **Where:** `transitionOrder()`, reached through `orderTransitionAction`.
- **Problem:** `pending_payment → paid` is allowed by the generic transition, which records no payment reference. The UI hides that button, but the server action accepts any `to` value.
- **Evidence:** B-03.
- **Impact:** goods get shipped without being paid for.

### B-04 (H) Deactivated products are still purchasable
- **Where:** `createOrder()` → `getVariants()`.
- **Problem:** neither `products.active` nor the product's channel is checked. A stale cart or a crafted request can buy a withdrawn product.
- **Evidence:** B-04.

### B-05 (H) Cancelling a paid order leaves no refund obligation
- **Where:** `transitionOrder(..., 'cancelled')`.
- **Problem:** stock is restored, but `payment_status` stays `paid`. Nothing records that money is owed back, and no refund state exists.
- **Evidence:** B-05.

### B-06 (H) Admin stock edits overwrite concurrent reservations
- **Where:** `updateVariant()` through `saveVariantAction`.
- **Problem:** stock is written as an absolute value taken from a form that may be stale (a lost update).
- **Evidence:** B-06: the form loaded 10, a customer reserved 2, the admin saved 10, and stock was **10 instead of 8**.
- **Other gaps:** there is no stock-movement history and no record of who changed a price.

### B-07 (H) No idempotency on checkout
- **Where:** `placeOrderAction` / `createOrder()`.
- **Problem:** a double-click, retry or replay creates a second order and reserves stock twice.
- **Evidence:** B-07, where two orders were created.

### B-08 (C) A quotation can be approved after the RFQ was closed or reopened
- **Where:** `decideQuotation()`, `transitionRfq()`.
- **Problem:**
  - Closing an RFQ, or sending it back to review, leaves its `issued` quotation approvable.
  - `decideQuotation()` sets the RFQ to `approved` regardless of its current status.
- **Evidence:** B-08, both variants.
- **Impact:** the customer commits to a price that sales has withdrawn.

### B-09 (M) Open redirect
- **Where:** `safeNext()` in `src/lib/session.ts`.
- **Problem:** `"/\\evil.example"` is accepted; browsers normalise `\` to `/`.
- **Evidence:** B-09.

### B-10 (C) Demo HR directory, including an admin account, is seeded in every environment
- **Where:** `src/lib/db.ts`, `seed()`.
- **Problem:** once a real SMS provider is connected, the real owner of `09120000000` would get **admin access**, and the other demo numbers would get employee pricing.
- **Related:**
  - Demo modes (`OTP_MODE=display`, `PAYMENT_MODE=sandbox`) can be switched on in production through an environment variable, with nothing to stop it.
  - With `OTP_MODE=display`, the login code is sent to the browser.
- **Evidence:** B-10.

### B-11 (C) OTP brute force is not bounded per mobile
- **Where:** `issueOtp()` / `verifyOtp()`.
- **Problem:** each re-issued code resets the attempt counter, and the only limit is the 60-second resend gap. That allows about 5 guesses a minute, or roughly 7,200 a day, against a space of 90,000 codes (about 8% success per day per number). There is also no per-IP limit.
- **Evidence:** B-11: 20 wrong guesses were possible in four cycles.

### B-12 (H) No role separation among staff
- **Where:** `requireAdmin()` and `users.role`.
- **Problem:** any admin can change prices, record payments, confirm corporate orders and cancel orders. There is no separation of duties between sales, finance and warehouse.

### B-13 (H) No audit trail for administrative changes
- **Problem:** price, stock and product-setting changes leave no record. The `events` table covers status changes only.

### B-14 (H) Unauthenticated endpoints have no abuse limits
- **Where:** `submitRfqAction`, `bookMeetingAction`, `trackRfqAction`.
- **Problem:**
  - Anyone can create unlimited RFQs.
  - Anyone can book every meeting slot, blocking real customers.
  - Anyone can try tracking codes against a known phone number without limit: the 5-digit random part gives a 90,000 space.

### B-15 (H) Guests can approve quotations with only a code and phone number
- **Where:** `decideQuotationAction` / `canAccessRfq`.
- **Problem:** knowing the tracking code and the contact phone, which is often a public company number, grants the right to approve a financial commitment. Approval should require an OTP-verified identity.

### B-16 (M) Corporate order confirmation is not constrained
- **Where:** `corporate_orders`.
- **Problem:** there is no `UNIQUE(rfq_id)`. The status check prevents duplicates inside one process, but the database does not enforce it.

### B-17 (M) Quotation expiry uses the UTC date and leaves a dead state
- **Where:** `expireQuotations()`.
- **Problem:** expiry compares `validUntil` (a Tehran date) with the UTC date, which is up to 3.5 hours off. When the quote expires, the RFQ stays `quoted` with nothing left to approve.

### B-18 (M) Employee eligibility is checked only at login
- **Problem:** a session lasts 30 days, so someone who leaves the company keeps employee pricing until the session expires. Checkout does not re-check HR.

### B-19 (M) Missing security headers
- **Problem:** no CSP, `X-Frame-Options`/`frame-ancestors`, `nosniff`, `Referrer-Policy` or HSTS. Clickjacking of the admin panel was possible.

### B-20 (M) Production secrets are not required
- **Problem:** if `SESSION_SECRET` is unset, a random secret is generated and stored in the same database it protects. That is acceptable for development but should be required in production.

### B-21 (M) No schema migrations
- **Problem:** schema changes can't be applied to existing databases. Several indexes are missing: `orders(user_id)`, `orders(status, created_at)`, `rfqs(user_id)`, `rfqs(phone)`, `quotations(rfq_id)`, `sessions(user_id)`, `order_items(order_id)`, `rfq_items(rfq_id)`. Status columns have no CHECK constraints.

### B-22 (M) The smoke test does not reliably fail
- **Where:** `scripts/smoke-test.mjs`.
- **Problems:**
  1. Browser console and page errors are collected and **printed, but never fail the run** (exit code 0).
  2. Several "assertions" are only `console.log` calls: the fragrance count, the empty state, the MOQ error and the suggested price.
  3. Playwright is not declared in `package.json`; the test relied on a globally installed copy.
  4. There is no test database isolation: it runs against whatever DB the server uses.

  Unhandled throws do exit non-zero, because of top-level await.

### B-23 (M) Customers cannot cancel their own unpaid order
- **Problem:** stock stays reserved until the 30-minute expiry.

### B-24 (L) Address book has no limit
- **Problem:** an unbounded number of addresses can be added per user.

### B-25 (L) No lint configuration

## 3. Behaviour that needs a business decision (not invented)

- **Per-employee purchase limits** are per order only. Repeated orders can exceed any "monthly" intent. There is no defined rule, so this is documented, not changed.
- **Landline RFQ contacts** (`021…`) can't log in with OTP and therefore can't approve a quotation online once approval requires a verified identity. Sales must record such approvals. That workflow is not yet defined.
- **Partial payments** (for example, the 50% deposit in the default terms) are not modelled. Confirming a corporate order records one payment or PO reference.
- **Refund execution** requires finance procedures and a payment-provider API, neither of which exists.
- **Company accounts with multiple buyers and approval chains** do not exist. This is a feature gap, not something to fix by assumption.
