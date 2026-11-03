# Implemented vs simulated, integrations, deployment, roadmap

## Implemented and persisted

- Catalog, variants, stock and per-order caps, stored in SQLite and editable in admin. Orders keep the price at the time of purchase.
- B2C cart, checkout, address book (Iranian format: province, city, plaque, unit, 10-digit postal code, `09…` mobile), atomic stock reservation, 30-minute payment window with auto-release, order timeline, reorder.
- Employee eligibility states: eligible, pending, ineligible, not an employee. Each is enforced on the server.
- B2B rules: MOQ, carton step, volume tiers (hidden from guests), customisation options adding lead time, quote-only bundles.
- RFQ basket and submission with validation (Jalali deadline, occasion, budget, contact details) and a lead-time warning.
- The full B2B state machine:
  - inquiry → review → versioned quotation (with VAT, discount, validity, auto-expiry)
  - customer approval or decline
  - pro forma (printable) → confirmed corporate order with a payment/PO reference → production → shipped → delivered
- Meeting requests with slot conflict protection; sales confirms, cancels or completes them.
- Request tracking for logged-in users, and for guests via code + phone. The response is the same whether the code or the phone is wrong, so codes can't be probed.
- Admin: dashboard, prices and inventory, product B2B rules, order transitions, manual payment reconciliation, quotation builder, meetings, customers, integration status.

## Simulated or not connected (always labelled in the UI)

| Feature | Current behaviour | Needed for production |
|---|---|---|
| **Employee verification** | Demo HR directory (`src/data/demo-directory.ts`), labelled «نمونهٔ اولیه» on the login page | Mammut HR/IdP API or SSO (OIDC/SAML) returning employment status, unit and employee code. Replace `resolveEligibility()` in `src/lib/repo/users.ts`. |
| **SMS OTP** | `OTP_MODE=display` shows the code on screen; the default in production is `disabled` (login blocked) | An SMS provider account (e.g. Kavenegar or SMS.ir) with an approved OTP template. Send `res.code` in `requestOtpAction`. Add IP rate limiting. |
| **Online payment** | `PAYMENT_MODE=sandbox` simulates gateway success or failure. Orders get `paid_sandbox` and a «پرداخت آزمایشی» badge, and the admin shows sandbox revenue separately. With `disabled`, orders stay «در انتظار پرداخت». | A Shaparak PSP merchant account (e.g. Zarinpal, IDPay or a bank IPG). Implement the request/redirect/verify callback, convert Toman to Rial (×10) and verify on the server before `paid`. |
| **Payroll deduction** | Visible but disabled («به‌زودی»); the server rejects it | HR/finance API for credit limit, instalments and posting. Flip `payrollAdapterImplemented` once implemented. |
| **Meeting calendar** | A request holds the slot; sales confirms manually in admin | Google/Outlook calendar or CRM integration for availability and invites; email/SMS notifications. |
| **Product photography** | Data-driven SVG renders (`ProductArt`) with a visible note | Studio photos; swap `ProductArt` for `next/image`. |
| **Notifications** | Status changes visible in the app only | SMS/email on order and RFQ transitions (hooks: `addEvent`). |
| **Seller legal details on the pro forma** | Placeholder text | Legal name, national ID, economic code and bank details from finance. |

## Deployment

1. Run Node 22 or later. `npm ci && npm run build && npm start`. better-sqlite3 needs a writable volume for `DATABASE_PATH`; use a single instance only.
2. Set `NODE_ENV=production`, `SESSION_SECRET` (32+ random bytes), `DATABASE_PATH`, and `PAYMENT_MODE` / `OTP_MODE` explicitly. Production defaults to `disabled` for both.
3. Serve behind HTTPS; the session cookies are `Secure` in production.
4. Back up the SQLite file (with WAL) on a schedule, or move to PostgreSQL first (see the roadmap).

## Prioritised roadmap to production

1. **Identity:**
   - HR/SSO eligibility integration and an SMS OTP provider
   - rate limiting on OTP and tracking endpoints
   - an admin role model (sales, finance, warehouse) in place of a single admin flag
2. **Payments:**
   - a Shaparak PSP with server-side verification, idempotent callbacks and refunds
   - turn off the sandbox in production
3. **Database:**
   - move to PostgreSQL with migrations
   - replace lazy order and quotation expiry with a scheduled job
4. **Notifications:** SMS/email for order status, new quotation, meeting confirmation and SLA reminders to sales.
5. **Admin completeness:**
   - create and edit products with images
   - variant add/remove, bulk stock import, a stock movement log
   - CSV export for finance
6. **B2B depth:**
   - company accounts with multiple buyers and approval chains
   - contract price lists per company
   - file upload for logos and briefs
   - split delivery addresses for welcome kits
7. **Payroll deduction** once the finance API exists, with caps per employee.
8. **Quality:**
   - unit tests for `pricing.ts` and the state machines
   - CI running typecheck, build and the Playwright smoke test (`scripts/smoke-test.mjs`)
   - analytics and error monitoring
