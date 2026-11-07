# Production readiness

**Verdict: not ready for real customer orders or real money.**

The code is now a sound foundation:
- server-authoritative pricing
- race-safe inventory with a reconcilable ledger
- a consistent and audited B2B state machine
- role-separated staff operations
- fail-closed production configuration
- 112 automated tests, plus 9 E2E journeys

Go-live is blocked by missing integrations and operations, not by known defects in the implemented logic.

## Go-live blockers (must be done)

| # | Item | Why it blocks | Work |
|---|---|---|---|
| 1 | **Payment provider (Shaparak PSP)** | Today there is only the sandbox (refused in production) and manual reconciliation by finance. | Implement request, redirect and server-side verify against the PSP. Make callbacks idempotent on the order ID and PSP reference (the unique `payment_ref` index exists). Verify the amount (Toman ×10 = Rial). Add a refund API or a documented manual procedure. |
| 2 | **SMS provider** | With no provider, production login is disabled by design. | Send `issueOtp().code` in `requestOtpAction`, using a provider OTP template, and add delivery failure handling. |
| 3 | **HR eligibility source** | Production has no employees until HR data exists. | Interim: `npm run hr:import` from an HR CSV (done; all-or-nothing and audited). Target: HR API or SSO, re-checked at checkout (the hook exists: `refreshEligibility`). |
| 4 | **Reverse proxy and `TRUST_PROXY=true`** | Without it, per-IP rate limits share one bucket. | Terminate TLS at a proxy (nginx or Caddy) that overwrites `X-Forwarded-For`. |
| 5 | **Backups** | A single SQLite file is the only copy. | Scheduled `VACUUM INTO` to off-host storage, a restore drill, and `reconcile()` after restore. |
| 6 | **Legal and finance data on the pro forma** | Seller legal name, national ID and economic code are placeholders. | Finance provides them; render them from configuration. |
| 7 | **Business sign-off on the open decisions** | See the next section. | — |

## Open business decisions (documented, not invented)

1. Per-employee purchase limits beyond the per-order cap (for example monthly), and whether they apply per variant or per amount.
2. How landline RFQ contacts approve quotations: needs a sales "approval received offline" action with evidence.
3. Partial and deposit payments for corporate orders. The default terms text mentions 50%, but only one reference is modelled.
4. The refund execution procedure and who approves refunds above a threshold.
5. Whether to introduce company accounts with multiple buyers, approval chains and contract price lists. None exist today.
6. Confirm the role split in ADR-004, especially finance versus catalog pricing.

## Strongly recommended before scale

- **PostgreSQL:** see the migration triggers in ADR-002. Required before running a second instance or a separate worker.
- **Scheduled jobs:** expiry of orders and quotations is lazy, triggered by page reads. Add a scheduler once on PostgreSQL. The functions are idempotent and safe to run concurrently.
- **Nonce-based CSP:** remove `'unsafe-inline'` for scripts.
- **Staff authentication hardening:** a second factor beyond SMS for the `admin` and `finance` roles.
- **Observability:** structured logs, error tracking, alerts on `reconcile()` drift, on growth in `refund_pending`, and on `SQLITE_BUSY`.
- **N+1 queries:** `listOrders` and `listRfqs` load items and events one row at a time. This is fine at current data sizes but unmeasured at scale. Paginate the admin lists.
- **Load test:** no performance or scalability claim is made. Measure checkout and admin list latency before launch.
- **CSV import robustness:** `hr:import` does not support quoted fields that contain commas.

## Readiness by area

| Area | State |
|---|---|
| B2C pricing, cart, checkout | Server-authoritative; caps, eligibility, activity and stock all enforced. Real payment is missing. |
| Inventory | Atomic, ledger-backed, reconcilable, safe across processes (tested with 4 processes). |
| Order lifecycle | Guarded transitions, expiry, customer cancel, refund obligation. Refund execution is manual. |
| B2B workflow | Inquiry, quotation (versioned, expiring, withdrawable), pro forma, confirmed order: consistent and audited. No company accounts and no partial payments. |
| AuthN | OTP with per-mobile and per-IP abuse limits, hashed sessions with rotation. Needs a real SMS provider. Staff 2FA is missing. |
| AuthZ | Role-separated and enforced in the service layer and on every admin page. Tested. |
| Admin operations | Prices, stock (delta and reason), orders, payments, refunds, RFQs, quotations, meetings, customers, staff roles, audit log. Product creation and image upload are missing. |
| Audit | Append-only audit log and inventory ledger for all money, stock and price changes. |
| Configuration | Fail-closed in production (startup refusal verified). |
| Testing | 112 unit/integration tests, 1 mutation spot-check, 9 E2E journeys run 3 times consecutively. No load tests and no cross-browser runs (Chromium only). |
| Deployment | Single-process SQLite. No CI pipeline in the repository. |
