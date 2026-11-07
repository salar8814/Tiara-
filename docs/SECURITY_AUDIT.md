# Security audit

- **Scope:** all code at the remediation commit (see the commit hash in TESTING_REPORT).
- **Method:** I read every server action, page guard and repository function, and wrote executable tests for each control that is claimed below. Anything verified only by inspection says so.
- **What this is not:** this is not a penetration test, and nothing has been reviewed by a third party.

## Identity and authentication

| Control | Implementation | Verified by |
|---|---|---|
| Identity source | Only the `httpOnly`, `SameSite=Lax` session cookie (`Secure` in staging and production). It is resolved against the DB on **every** request (`currentUser`). Roles and eligibility are re-read, never trusted from the client. | `authz-services.test.ts` (a stale actor object loses rights after its role is revoked) |
| Session tokens | 32 random bytes; only the SHA-256 is stored. 14-day absolute expiry. Expired rows are purged when new sessions are created. | `auth.test.ts` "tokens are stored hashed and expire" |
| Rotation / invalidation | Login destroys any session already in the browser (`startSession`). Logout deletes the row. Changing someone's role deletes all their sessions. | `auth.test.ts` "logout invalidates"; `authz-services.test.ts` "granting a role ends that person's sessions" |
| OTP | 5 digits from `crypto.randomInt`. Stored hashed and compared in constant time. 2-minute TTL, single use, 5 attempts per code. | `auth.test.ts` |
| OTP abuse | Per mobile: 60-second cooldown, 5 codes per hour, 10 wrong guesses per 24 hours across codes (then locked). Per IP: 20 codes and 60 verifications per hour. Counters persist in SQLite. | `auth.test.ts` "B-11 …", "60 s resend cooldown …" |
| OTP never in the browser in production | The code is returned to the client only when `otpMode() === "display"`. That mode throws in production, and the production server refuses to start with it. | `authz-config.test.ts`, `production-env.test.ts`, `evidence/production-startup-refusal.txt` |
| Demo accounts | Demo HR rows and demo staff are seeded only outside production. A production DB containing them refuses to open. In production the demo numbers have no eligibility and no roles. | `production-env.test.ts` |

**Residual risk.** Without `TRUST_PROXY=true`, all clients share the per-IP bucket, whose limits are 20× wider. Per-mobile limits still bound OTP guessing, but RFQ and meeting spam is then bounded only globally. Production must run behind a proxy that overwrites `X-Forwarded-For`.

## Authorization

- **Model:** `src/lib/authz.ts`. The permission matrix is tested for every role, for ordinary employees and for anonymous users.
  - **sales:** RFQs, quotations, meetings, customer lookup.
  - **finance:** payments, refunds, cancelling paid orders, confirming corporate orders.
  - **warehouse:** stock adjustments, fulfilment, corporate production and shipping.
  - **admin:** all of the above, plus catalog and pricing, staff roles and the audit log.
- **Enforcement points:**
  1. The service layer: `assertCan` in `src/lib/services/admin.ts`, the only path to privileged writes.
  2. Every admin page: `requireStaff(permission)`.
  3. Navigation is filtered, but that is UI only.
- **Customer isolation:**
  - Orders: `getOwnOrder` returns 404 for other users' orders.
  - Addresses: every query is scoped by `user_id`.
  - Payments and cancellations: the action re-checks ownership.
  - RFQs: reading needs owner, staff or a signed access cookie (`rfqReadAllowed`); deciding needs the owner (`canDecideRfq`).
  - Verified by `authz-services.test.ts` (IDOR on orders and addresses), `authz-config.test.ts` (RFQ rules) and E2E (another customer gets 404 on the order and payment pages; an employee is redirected away from `/admin`).
- **Company-level permissions:** **not applicable, because there are no company accounts.** B2B requests belong to one user or to a guest. A multi-buyer company model is a feature gap (see PRODUCTION_READINESS).

## Application security

| Area | Status |
|---|---|
| SQL injection | All queries use bound parameters. The only interpolated identifiers (`uniqueCode` table and column, `IN (?,?)` lists) are internal constants or generated placeholders. Verified by inspection. |
| XSS | React escaping only: no `dangerouslySetInnerHTML`, no `eval` (grep-verified). User text is rendered as text. The CSP blocks third-party scripts, though `'unsafe-inline'` is still needed for Next's bootstrap script (see residual risks). |
| CSRF | Server actions are POST-only, and Next.js rejects them when `Origin` does not match `Host`. The session cookie is `SameSite=Lax`. **I did not independently test the framework's Origin check.** |
| Clickjacking | `frame-ancestors 'none'` and `X-Frame-Options: DENY` (E2E-verified). |
| Open redirect | Fixed in `safeNext` (B-09); 7 cases tested. |
| Input validation | zod schemas for every customer form. All numeric admin input goes through integer parsing with range checks in the services. Enum-like values (statuses, roles) are validated by the transition maps and by DB triggers. Text fields are length-capped. |
| Client-trusted values | None. Prices, discounts, totals, stock, eligibility, MOQ/step and customisation IDs are recomputed on the server. Client cart and inquiry data are input only. |
| Sensitive data exposure | Personal pages send `Cache-Control: private, no-store`. Error pages show generic text. The tracking lookup returns the same message whether the code or the phone is wrong. Demo phone numbers appear only in non-production environments. |
| Secrets | `SESSION_SECRET` is required in production and must be at least 32 characters. `.env*` and `data/*.db` are git-ignored, and no secrets are committed (diff reviewed). The development fallback secret is stored in the DB `meta` table. |
| File uploads | None exist. |
| Dependencies | `npm audit --omit=dev`: **0 vulnerabilities**. Full `npm audit` on 2026-11-07: 8 moderate findings, all one advisory, `minimatch 7.0.0–11.0.0` (ReDoS), pulled in by the ESLint toolchain. It is dev-only and not shipped. Fixing it requires the ESLint ecosystem to upgrade; `npm audit fix --force` would install an incompatible ESLint. |

## Residual risks (unresolved)

1. **No real payment provider.** The verification and callback design exists only as a sandbox.
2. **CSP needs `'unsafe-inline'` for scripts.** A nonce-based CSP via `proxy.ts` is the fix and is not implemented.
3. **No WAF or global DDoS protection.** Rate limits are per process, in SQLite.
4. **Sales cannot record a customer's approval on their behalf**, for example for landline contacts. The workflow is undefined.
5. **No 2FA or hardware keys for staff.** Staff use the same SMS OTP as customers, so an admin account is only as strong as its SIM.
6. **No automated secret rotation.** Rotating `SESSION_SECRET` invalidates guest RFQ access cookies, but not sessions, which do not depend on it.
