# دنیای تیارا — Tiara Hybrid Commerce

A Persian-first (RTL) commerce platform for **Tiara (Mammut Group)** with two purchasing journeys on one catalog:

- **B2C, the employee store** (`/shop`): retail and employee prices side by side, variants, stock, cart, checkout, addresses, order tracking and reorder.
- **B2B, corporate sales** (`/corporate`): MOQ, carton steps and volume tiers, gift bundles, a multi-item RFQ basket, meeting requests, quotation and pro forma workflow, and confirmed corporate orders.
- **Admin** (`/admin`): products, prices and inventory, orders, RFQs and quotations, meetings, customers, and integration status.

## Quick start

```bash
npm install
cp .env.example .env.local   # demo settings: on-screen OTP, sandbox payment
npm run dev                  # http://localhost:3000
```

On first request, the SQLite database (`data/tiara.db`) is created and seeded from `src/data/`. Run `npm run db:reset` to start fresh.

### Demo accounts (prototype HR directory, `src/data/demo-directory.ts`)

| Mobile | State |
|---|---|
| 09121111111 | Active employee, gets employee pricing |
| 09122222222 | Active employee |
| 09123333333 | Employee whose activation is pending; cannot check out |
| 09124444444 | Former employee (ineligible) |
| 09120000000 | Admin (Tiara sales) |
| any other `09…` | Corporate customer (B2B only) |

With `OTP_MODE=display`, the login code is shown on screen because no SMS provider is connected.

### Checks

```bash
npm run typecheck
npm run build
# end-to-end smoke test: start the app on a fresh DB with OTP_MODE=display PAYMENT_MODE=sandbox, then
npm run smoke
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): information architecture, journeys, business rules, design system, data model.
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): what is implemented versus simulated, required integrations, deployment, and the production roadmap.
