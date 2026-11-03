# Architecture and design decisions

## Starting point

The repository was empty; the only baseline was the PDF «UI پیشنهادی بخش دنیای تیارا». It contains six screens: the landing page with B2C/B2B cards, the employee store, the cart and checkout (payroll deduction or gateway), the corporate catalog ("price after meeting"), meeting booking, and the request confirmation.

What we kept from the PDF's business logic:
- Two entry points.
- Transparent employee pricing in B2C.
- No public price in B2B; MOQ per product.
- Inquiry list and meeting with a sales expert.
- Tracking code and next steps after submission.

What we changed:
- **The B2B flow is now an explicit state machine.** The PDF went from "request submitted" straight to "pro forma after the meeting". The app now separates the inquiry (RFQ), the quotation (versioned, needing approval), the pro forma (issued on approval) and the confirmed order (after payment or a purchase order).
- **The meeting is a request.** Without a calendar integration, the slot is held and a sales expert confirms it; it is never shown as already booked.
- **Payroll deduction is shown but disabled** until the HR/finance integration exists. The PDF showed it as the default option.
- **Visual changes.** The full-bleed indigo bar is gone, which made the PDF feel like an internal portal. Neutrals are now warm, and product art is the focus.

## Information architecture

```
/                          Landing: two entry points, categories, featured, B2B process
├─ /shop                   B2C listing (category, search, price band, in-stock, sort; URL-driven)
│  └─ /shop/[slug]         B2C product: variants, stock, per-order cap, employee/retail price
├─ /cart                   Cart (client-persisted, server-validated)
├─ /checkout               Delivery method → address → payment (eligible employees only)
│  └─ /checkout/[code]     Payment step / result (sandbox or "gateway not connected")
├─ /corporate              B2B catalog (category, occasion, MOQ, customisable, search)
│  ├─ /corporate/[slug]    B2B product: MOQ, step, tiers, customisation, lead time, add to RFQ
│  ├─ /corporate/inquiry   Multi-item RFQ basket and submission form
│  ├─ /corporate/meeting   Meeting request (optionally linked to an RFQ)
│  ├─ /corporate/requests/[code]           Confirmation and tracking, quotation decision
│  ├─ /corporate/requests/[code]/proforma  Printable pro forma invoice
│  └─ /corporate/track     Guest lookup by code + phone
├─ /login                  Mobile + OTP; HR eligibility resolved on login
├─ /account                Overview, store orders, corporate requests/meetings, addresses
│  └─ /account/orders/[code]
└─ /admin                  Dashboard · products/prices/stock · orders · RFQs/quotations · meetings · customers
```

Both channels share one header, footer and taxonomy (`src/data/taxonomy.ts`). A section switches accent colour through `data-channel="b2b"`: indigo for personal shopping, terracotta for corporate.

## User journeys

1. **Employee purchase.** Browse, add to cart (no login needed), then check out. Checkout requires login, and eligibility is re-read from HR at login. The shopper chooses delivery (courier or workplace pickup) and an address, and the order is created with stock reserved for 30 minutes. The shopper then pays: in the sandbox, or the order stays "awaiting payment". After that come the order states (paid → processing → shipped → delivered), with reorder available.
2. **Corporate inquiry.** Browse the catalog and add items with quantity, customisation and a note. Submitting the RFQ needs contact, occasion, budget and a Jalali deadline. An optional meeting request follows, and the requester gets a tracking code.
3. **Sales handling (admin).** Start the review, then issue a quotation; it is versioned, with suggested prices from the tier table, VAT and validity. The customer approves or declines. Approval issues the pro forma. Sales then records the payment or purchase-order reference, which makes the order a confirmed corporate order, followed by production → shipped → delivered.
4. **Reorder.** B2C orders are re-added to the cart after a stock check. Closed or converted RFQs can be re-sent as a new inquiry.

## Business rules (all in data, not components)

| Rule | Where |
|---|---|
| Prices, variants, stock, per-order caps | `src/data/catalog.ts` (seed), then the DB, editable in `/admin/products` |
| MOQ, carton step, tiers, customisation options with extra lead days, quote-only mode | `b2b` block per product |
| Delivery methods and fees, free-shipping threshold, VAT 10%, code prefixes, quotation validity | `src/data/rules.ts` |
| Meeting days (Saturday to Wednesday), slots, types, duration; budget ranges | `src/data/rules.ts` |
| Status vocabulary and allowed transitions | `src/lib/status.ts` (used by both the UI and the server guards) |
| Employee price only for `eligibility = eligible` | `src/lib/pricing.ts`, enforced in `createOrder` |
| B2B tiers hidden from anonymous visitors; never shown when customisation is chosen or the product is quote-only | `b2bSnapshot()`, `b2bPriceVisible()` |
| Unpaid orders auto-cancel after 30 minutes and release stock | `expireStaleOrders()` |
| One active booking per meeting slot | partial unique index `meetings_slot` |

The server recomputes everything on submission: prices, stock, caps, MOQ/step and customisation IDs. Client state (the cart and the inquiry list in `localStorage`) is only a convenience.

## Design system

- **Type:** Vazirmatn variable, self-hosted (`public/fonts`, OFL), with Persian digits through `Intl` `fa-IR`.
- **Tokens** (`src/app/globals.css`, Tailwind v4 `@theme`):
  - ink, muted and subtle text
  - a warm canvas, surface and sunken backgrounds, plus line colours
  - indigo and clay scales
  - semantic success, warning, danger and info
  - radii (8, 12, 16, 20) and two shadows
- **Channel accent:** components use `accent-*`, which resolves to indigo, or to clay under `[data-channel="b2b"]`.
- **Primitives** (`src/components/ui.tsx`):
  - Button / LinkButton (primary, secondary, ghost, danger, dark)
  - Badge (tones), Notice (including a visible "prototype" variant)
  - Field / Input / Select / Textarea with linked error and hint text
  - Card, PageHeader, Breadcrumbs, EmptyState, Stepper, KeyValue, Money, Icon (inline SVG)
- **Domain components:** ProductCard and B2BCard, ProductArt (data-driven SVG standing in for photography), the buy box, the B2B configurator, CartView, CheckoutForm, InquiryForm, MeetingForm, JalaliDateInput, Timeline, and the admin forms.
- **States:** skeleton loading routes, empty states with next actions, inline field errors with focus moved to the first invalid field, success confirmations, and a global error boundary and 404.
- **Accessibility:**
  - native radios, checkboxes and selects behind styled labels
  - `aria-live` for basket and status updates, `aria-current` for navigation and steps
  - a skip link and visible focus rings
  - reduced-motion support
  - RTL and logical properties throughout

## Technical stack

- Next.js 16 App Router (server components, server actions), React 19, TypeScript strict, Tailwind CSS 4, zod 4.
- **SQLite** through better-sqlite3 for real persistence. All SQL lives in `src/lib/repo/*`, so moving to PostgreSQL means replacing those modules.
- **Auth:** OTP sign-in with a `httpOnly` session cookie holding a random token (only its SHA-256 is stored). OTP codes are hashed, expire after 2 minutes, allow 5 attempts, and have a 60-second resend limit.
- **Guest RFQ access** uses an HMAC-signed cookie, granted after submission or after a matching code + phone lookup. Guest RFQs are attached to an account when the same mobile number logs in with OTP.
- **Admin:** every admin action calls `requireAdmin()` on the server, independently of the layout guard.

## Data model

`products` (with a `b2b` JSON block) · `variants` · `hr_directory` (demo) · `users` · `otp_codes` · `sessions` · `addresses` · `orders` / `order_items` · `rfqs` / `rfq_items` · `quotations` (versioned, with `proforma_number`) · `corporate_orders` · `meetings` · `events` (a shared audit timeline for orders, RFQs, meetings and corporate orders).
