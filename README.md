# RSCryptoFX Client Portal

A full-stack **Forex Trading Client Dashboard** — a PAMM-style **performance reporting** portal (not an auto-trader). Built with Next.js 14 (App Router), TypeScript, TailwindCSS, Prisma + SQLite, Recharts, Zustand, and TradingView's free charting widgets.

Dark trading-terminal theme (zinc/slate with gold accents for XAUUSD), mobile responsive, styled like Myfxbook / FXBlue.

---

## Quick start

```bash
npm install      # installs deps (Prisma downloads its query engine here)
npm run dev      # sets up + seeds the SQLite DB on first run, then starts Next
```

Open **http://localhost:3000** and sign in with a demo account:

| Role   | Email                   | Password   |
| ------ | ----------------------- | ---------- |
| Admin  | `admin@rscryptofx.com`  | `admin123` |
| Client | `client@rscryptofx.com` | `client123`|

> First `npm run dev` auto-creates `.env`, pushes the Prisma schema to a local
> SQLite database, and seeds demo data. No manual setup required.

### Useful scripts

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Setup + seed (first run) then start the dev server      |
| `npm run build`     | `prisma generate` + production build                    |
| `npm run start`     | Start the production server                             |
| `npm run db:seed`   | Re-seed demo data                                       |
| `npm run db:reset`  | Wipe + re-create + re-seed the database                 |

---

## Features

### 1. Auth & clients
- Simple cookie-based login with **admin / client** roles (`src/lib/auth-config.ts`).
- Clients: name, email, phone, account number, initial deposit, start date, status.
- Route protection via `src/middleware.ts`. Mutations are admin-only.

### 2. Deposit / withdrawal ledger
- Entries: date, client, type (deposit/withdrawal), amount USD, method (bank/crypto/otc), notes, status (pending/approved).
- **Approved** entries automatically update the client balance (the equity curve recomputes from the ledger).
- **CSV import & export**, plus filtering by client and date range.

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

| Route                  | Description                                  |
| ---------------------- | -------------------------------------------- |
| `/login`               | Login                                        |
| `/dashboard`           | KPI cards + equity chart + daily log         |
| `/clients`             | Client list + add client                     |
| `/ledger`              | Deposits/withdrawals table, filters, CSV     |
| `/charts`              | Full TradingView XAUUSD chart + watchlist    |
| `/reports`             | Pick a client                                |
| `/reports/[clientId]`  | Client statement + PDF export                |

---

## Data model (Prisma)

`Client`, `Transaction`, `DailyPerformance` — see `prisma/schema.prisma`.

> SQLite doesn't support native enums, so enum-like fields (`status`, `type`,
> `method`) are stored as strings and constrained at the app layer in
> `src/lib/constants.ts`.

### Switching to Postgres
1. In `prisma/schema.prisma`, set `provider = "postgresql"` (optionally promote the string fields back to real `enum`s).
2. Set `DATABASE_URL` to your Postgres URL in `.env`.
3. `npx prisma migrate dev`.

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

Next.js 14 · TypeScript · TailwindCSS (shadcn-style primitives) · Prisma + SQLite · Recharts · Zustand · TradingView widgets · jsPDF · PapaParse.

> Demo/educational project. Past performance is not indicative of future results. Not financial advice.
