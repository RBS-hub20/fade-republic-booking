# QuantumX Global Markets

**Trade Beyond Limits.** A full-stack **Forex/multi-asset trading client portal** — a PAMM-style **performance reporting** platform (not an auto-trader). Built with Next.js 14 (App Router), TypeScript, TailwindCSS, Prisma + PostgreSQL, Recharts, Zustand, and TradingView's free charting widgets.

Dark trading-terminal theme (zinc/slate with gold accents for XAUUSD), mobile responsive, styled like Myfxbook / FXBlue.

---

## Quick start (local)

Requires a PostgreSQL database. The easiest path is the bundled Docker Postgres:

```bash
docker compose up -d   # start Postgres on localhost:5432
npm install            # installs deps (Prisma downloads its query engine here)
npm run dev            # generates client, pushes schema, seeds (first run), starts Next
```

No Docker? Point `DATABASE_URL` in `.env` at any Postgres instance instead (see
`.env.example`), then `npm run dev`.

Open **http://localhost:3000** and sign in with a demo account:

| Role   | Email                   | Password   |
| ------ | ----------------------- | ---------- |
| Admin  | `admin@quantumxglobal.com`  | `admin123` |
| Client | `client@quantumxglobal.com` | `client123`|

> `npm run dev`, `npm run build` and `npm start` all run `scripts/db-deploy.mjs`
> first: generate the Prisma client, push the schema, and seed demo data **only
> when the database is empty** (so a redeploy never wipes real data). It never
> hard-fails — if the DB is unreachable the app shows a friendly notice instead
> of crashing.

### Useful scripts

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | DB setup + seed (if empty) then start the dev server    |
| `npm run build`     | DB setup + `prisma generate` + production build         |
| `npm run start`     | DB setup then start the production server               |
| `npm run db:seed`   | Re-seed demo data                                       |
| `npm run db:reset`  | Wipe + re-create + re-seed the database                 |

---

## Deploying to Vercel

1. Provision a Postgres database — **Vercel Postgres**, **Neon**, or **Supabase**.
2. In the Vercel project → **Settings → Environment Variables**, set:
   - `DATABASE_URL` — your connection string (a pooled URL is fine for the app).
   - `DIRECT_URL` *(optional)* — a **direct/non-pooled** URL, used only for the
     schema push. Set this if your provider uses a pgbouncer pool.
     - Vercel Postgres: `DATABASE_URL` = `POSTGRES_PRISMA_URL`, `DIRECT_URL` = `POSTGRES_URL_NON_POOLING`.
     - Neon: use the pooled string for `DATABASE_URL` and the direct string for `DIRECT_URL`.
   - `SESSION_SECRET` — a long random string used to sign session cookies.
3. Deploy. The build runs `db-deploy` (generate → push → seed-if-empty) then
   `next build`, so the schema and demo data are provisioned automatically on the
   first deploy. Subsequent deploys leave existing data untouched.

---

## Features

### 1. Accounts & auth (real, persisted)
- **Sign up** creates a `User` (hashed password via Node scrypt — `src/lib/password.ts`)
  plus a linked trading `Client` account. **Log in** verifies against the database.
- Sessions are **signed** cookies (HMAC, `src/lib/session.ts`) carrying role + clientId.
- Two roles:
  - **Client** — sees only their own account: dashboard, wallet, charts, statement.
  - **Admin** — monitoring portal: all clients, approvals, full ledger, reports.
- Route protection via `src/middleware.ts` + per-page role guards.

### 2. Deposits & withdrawals (request → approval)
- **Clients** submit deposit/withdrawal **requests** from `/wallet` (created as `PENDING`).
- **Admins** review them on `/approvals` and **Approve** or **Reject**.
- **Approved** entries automatically update the client balance (the equity curve
  recomputes from the ledger). Admins can also add entries directly in the `/ledger`
  with **CSV import & export** and client/date filters.

### 3. Trading performance dashboard
- PAMM-style **compounded equity curve** per client (and a portfolio aggregate).
- Default estimate **0.3%–0.6% per trading day, Mon–Fri only** (weekends skipped, **Asia/Manila** timezone).
- Admins can enter an **actual daily %** per day (blank → random 0.3–0.6% estimate) from a client's report page.
- KPI cards: Current Balance, Total Deposits, Total Withdrawals, Total Net P/L, Win Rate, Avg Daily %.
- Equity chart (Recharts) with **1W / 1M / 3M / YTD / All** toggles.
- Daily performance log: date, daily %, daily P/L, balance EOD.

### 4. Live forex charting
- Full **TradingView Advanced Chart** widget (default `OANDA:XAUUSD`), no API key needed.
- Symbol switcher: XAUUSD, EURUSD, GBPUSD, USDJPY, BTCUSD.
- Timeframe buttons: 1m, 5m, 15m, 1h, 4h, 1D.
- Right-sidebar **live watchlist** with % change.

### 5. Client report export
- Per-client statement: deposits, withdrawals, daily P/L, equity curve.
- **"Export Monthly Report"** generates a branded PDF (jsPDF) client-side.

---

## Pages

| Route                  | Access  | Description                                  |
| ---------------------- | ------- | -------------------------------------------- |
| `/`                    | public  | Marketing landing page                       |
| `/login` · `/signup`   | public  | Log in / create an account                   |
| `/dashboard`           | both    | KPIs + equity chart (own account / portfolio)|
| `/wallet`              | client  | Submit deposit / withdrawal requests         |
| `/approvals`           | admin   | Approve / reject client requests             |
| `/clients`             | admin   | Client list + add client                     |
| `/ledger`              | admin   | Deposits/withdrawals table, filters, CSV     |
| `/charts`              | both    | Full TradingView XAUUSD chart + watchlist    |
| `/reports`             | admin   | Pick a client                                |
| `/reports/[clientId]`  | scoped  | Client statement + PDF export (own if client)|

---

## Data model (Prisma)

`Client`, `Transaction`, `DailyPerformance` — see `prisma/schema.prisma`
(PostgreSQL).

> Enum-like fields (`status`, `type`, `method`) are stored as strings and
> constrained at the app layer in `src/lib/constants.ts`, keeping the model
> portable. You may promote them to native Postgres `enum`s if desired.

The schema is applied with `prisma db push` (run automatically by
`scripts/db-deploy.mjs`). To adopt versioned migrations later, switch to
`prisma migrate dev` / `prisma migrate deploy`.

---

## Where to connect a real broker API

This portal is **reporting only**. The integration seams are commented in-code:

- **`src/lib/performance.ts`** — `dailyPercent` is the single seam where a live
  broker / PAMM return feed plugs in. Replace the stored/estimated percentages
  with the broker's actual daily returns; the compounding math is unchanged.
- **`src/components/charts/tradingview-chart.tsx`** — charts are read-only market
  data. For live account data / order execution, integrate a broker trading API
  (e.g. OANDA v20, MetaApi, cTrader Open API) in a server route.
- **`src/lib/auth-config.ts`** — demo credentials; swap for a real user store +
  password hashing and a signed session.

---

## Tech stack

Next.js 14 · TypeScript · TailwindCSS (shadcn-style primitives) · Prisma + PostgreSQL · Recharts · Zustand · TradingView widgets · jsPDF · PapaParse.

> Demo/educational project. Past performance is not indicative of future results. Not financial advice.
