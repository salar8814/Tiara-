# دنیای تیارا — Tiara Hybrid Commerce

Persian-first (RTL) commerce platform for **Tiara (Mammut Group)**: an employee store (B2C) and corporate sales with RFQ → quotation → pro forma → confirmed order (B2B), on one catalog, plus a role-separated staff panel.

> **Status:** hardened foundation, **not production-ready**. Payment gateway, SMS, HR integration and PostgreSQL are still missing — see [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

## Quick start (development)

```bash
npm ci
cp .env.example .env.local     # TIARA_ENV=development, on-screen OTP, sandbox payment
npm run dev                    # http://localhost:3000
```

The SQLite database is created, migrated and seeded on first request. `npm run db:reset` deletes it.

### Demo accounts (development/test only — never loaded in production)

| Mobile | Who |
|---|---|
| 09121111111 / 09122222222 | active employees (employee pricing) |
| 09123333333 | employee pending activation |
| 09124444444 | former employee (ineligible) |
| 09120000000 | staff: **admin** |
| 09126660001 / 09126660002 / 09126660003 | staff: **sales** / **finance** / **warehouse** |
| any other `09…` | corporate customer |

## Checks

```bash
npm run typecheck
npm run lint
npm test                 # unit + integration (isolated temp SQLite per file; includes a 4-process concurrency test)
npm run build
npm run test:e2e         # Playwright against the production build, throw-away DB, TIARA_ENV=test (build first)
npm audit --omit=dev
```

## Production bootstrap

```bash
TIARA_ENV=production SESSION_SECRET=… DATABASE_PATH=/var/lib/tiara/tiara.db npm start   # migrates on start
npm run hr:import -- ./hr-export.csv          # eligibility directory from HR (CSV, all-or-nothing, audited)
npm run staff:grant -- 09xxxxxxxxx admin      # first administrator; further roles from /admin/staff
```

## Documentation

| | |
|---|---|
| [BASELINE_AUDIT](docs/BASELINE_AUDIT.md) | findings at `d10c915` with reproductions |
| [SECURITY_AUDIT](docs/SECURITY_AUDIT.md) | threat review and controls |
| [REMEDIATION_LOG](docs/REMEDIATION_LOG.md) | what was fixed, where, and the test proving it |
| [TESTING_REPORT](docs/TESTING_REPORT.md) | commands and actual results |
| [ARCHITECTURE_DECISIONS](docs/ARCHITECTURE_DECISIONS.md) | ADRs (SQLite, concurrency, roles, …) |
| [PRODUCTION_READINESS](docs/PRODUCTION_READINESS.md) | honest readiness assessment and remaining work |
| [ARCHITECTURE](docs/ARCHITECTURE.md) · [INTEGRATIONS](docs/INTEGRATIONS.md) | product architecture and integration status |
| [Tiara-UI-Design.pdf](docs/design/Tiara-UI-Design.pdf) | UI design document (32 pages, screenshots of the running app, Persian) |
