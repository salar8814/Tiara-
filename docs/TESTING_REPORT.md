# Testing report

**Environment:** Node v22.23.4, npm 10.9.9, Linux. Chromium build 1243 via `@playwright/test` 1.63.0 (pinned to the installed browser).

The raw output of the final run is in `docs/evidence/final-verification.txt`.

## Final verification (clean install, 2026-11-07)

| Command | Result |
|---|---|
| `rm -rf node_modules .next && npm ci` | 445 packages installed |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, 0 problems |
| `npm test` (vitest) | **10 files, 112 tests passed**, 0 failed, 0 skipped |
| `npm run build` | compiled successfully, no warnings |
| `npm run test:e2e` | **9 passed**. Earlier, the suite also ran 3 consecutive times, all green. |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` | 8 moderate, dev-only (`minimatch` via the ESLint toolchain; see SECURITY_AUDIT) |

## Test inventory

| File | Tests | Covers |
|---|---|---|
| `tests/unit/pricing.test.ts` | 11 | employee and retail price, discount %, shipping threshold, totals, MOQ and carton rules, tier selection, quote-only and customisation price hiding, lead time |
| `tests/unit/authz-config.test.ts` | 26 | full permission matrix per role (and for employees and anonymous users), RFQ read and decide rules, `safeNext` (7 cases), environment gating (production refuses demo modes, needs a secret, rejects unknown modes) |
| `tests/integration/orders.test.ts` | 28 | server-authoritative pricing, eligibility (including a leaver with an active session), duplicate-line cap bypass, inactive products, foreign addresses, reservation, last unit, single release on expiry, expiry vs cancel race, idempotent checkout, payment failure and retry, double callback, expiry before payment, `paid` only via payment, unique payment reference, refund obligation and recording, customer cancel, ledger reconciliation |
| `tests/integration/rfq.test.ts` | 13 | full lifecycle (inquiry ≠ quotation ≠ order), VAT after discount, single confirmation, invalid quotations, forced transitions, versioning and supersede, re-quote after decline, withdrawal on close or reopen, expiry (and the last valid day), owner-only approval, audit |
| `tests/integration/authz-services.test.ts` | 13 | every privileged service denied to anonymous users, customers and employees; per-role denials (sales, finance, warehouse); quote lines limited to RFQ items; delta stock that keeps concurrent reservations; price validation; audit before/after; append-only audit and ledger; staff role changes end sessions; last-admin protection; order and address IDOR |
| `tests/integration/auth.test.ts` | 9 | OTP single use, expiry, per-code lock, cooldown and hourly cap, daily guess budget across codes, fixed-window limiter, hashed and expiring sessions, logout, atomic first login |
| `tests/integration/production-env.test.ts` | 4 | separate process with `TIARA_ENV=production`: no demo HR or staff, demo numbers get no rights, demo modes refused, a DB that contains demo rows refuses to open |
| `tests/integration/migration.test.ts` | 1 | a v1 (baseline) DB upgrades in place: admins move to roles, the ledger reconciles, status triggers are active, the catalog is not duplicated |
| `tests/integration/meetings-addresses.test.ts` | 5 | one booking per slot, cap of 2 active requests per phone, working-day window, meeting transitions, address cap |
| `tests/integration/concurrency.test.ts` | 2 | **4 OS processes on one DB file:** 200 contended expiries give exactly 200 releases; 40 purchases for 20 units give exactly 20 sold and stock 0. The ledger reconciles. |
| `tests/e2e/journeys.spec.ts` | 9 | security headers; full B2C journey with validation and sandbox payment; cross-customer 404s and the employee→admin redirect; B2B MOQ, RFQ and meeting; role-specific admin UI; guest read-only and owner approval with pro forma; finance confirmation with audit; pending and ineligible checkout; no horizontal overflow at 390 px on 10 pages |

## Isolation

- Each vitest file runs in its own fork with its own temporary SQLite file (`tests/setup.ts`).
- E2E starts its own `next start` with a throw-away DB in `TIARA_ENV=test` (`playwright.config.ts`).
- Nothing touches `data/tiara.db`.

## Evidence that the tests detect regressions

1. **Baseline reproductions.** All 12 failed against `d10c915`; output in `docs/evidence/baseline-repro-d10c915.txt`, and the archived suite is `docs/evidence/baseline-repro.test.ts`. The same scenarios now live, as passing tests, in the files above.
2. **Mutation spot-check** (`docs/evidence/mutation-check.txt`):
   - Removing the cancellation status guard fails 4 tests.
   - Removing line merging fails 1 test.
   - Allowing the generic transition to `paid` fails 1 test.
3. **Multi-process baseline comparison** (`docs/evidence/baseline-multiprocess-expiry.txt`): the baseline expiry algorithm under the same 4-process harness released 400 units instead of 200 in 4 of 5 trials.
4. **The strengthened mobile-overflow E2E test** failed before the fieldset fix (497 px on `/shop`) and passes after it.

## Defects the new tests found (and that were then fixed)

- **N-01:** concurrent first logins crashed on `UNIQUE(mobile)`. Found by the concurrency test.
- **N-02:** form input was wiped after validation errors. Found by E2E.
- **N-07:** horizontal overflow on phones. Found while capturing the design PDF.

## Test mistakes I corrected (not product changes)

1. The shipping expectation in `pricing.test.ts`: a payable of 2,845,000 is below the 3,000,000 threshold, so the fee applies.
2. A stale actor object in the last-admin test. The app re-reads the actor on every request, so the test now does too.
3. Several ambiguous Playwright text selectors, made strict.
4. Filtering only the two intentional 404 console messages in the isolation test.

## Gaps (not covered by automated tests)

- **Server-action wiring:** per-IP rate limits inside actions, and Next's CSRF Origin check. Actions need a request context; the underlying limiter and services are tested.
- **Browser coverage:** Chromium only. Firefox and Safari were not run.
- **Load testing:** none; no performance claims are made.
- **Accessibility:** no automated audit (e.g. axe). Labels, focus and ARIA were reviewed manually.
- **Real integrations:** the payment provider, SMS and HR API do not exist yet.
- **No CI pipeline** is configured in the repository; all checks were run locally in this session.
