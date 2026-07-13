/**
 * Core PAMM-style performance math for QuantumX Global Markets.
 *
 * This is a *reporting* engine, not an auto-trader. It takes a client's opening
 * balance, their deposit/withdrawal ledger, and a set of per-day performance
 * percentages, then compounds them into a daily equity curve.
 *
 * Trading happens Monday–Friday only; weekends are skipped. All "today"
 * reasoning is anchored to the Philippine timezone (Asia/Manila).
 *
 * NOTE FOR REAL BROKER INTEGRATION:
 *   The `dailyPercent` values are the seam where a real broker / PAMM feed
 *   plugs in. Today they are admin-entered (or randomly estimated). To wire a
 *   live account, replace the stored DailyPerformance.dailyPercent with the
 *   broker's actual daily return and keep the rest of this module unchanged.
 */

export const MANILA_TZ = "Asia/Manila";

/** Default estimated daily performance band when no actual value is provided. */
export const DEFAULT_MIN_DAILY_PCT = 0.3;
export const DEFAULT_MAX_DAILY_PCT = 0.6;

/** A single calendar day in the equity curve. */
export interface EquityPoint {
  /** Date as `yyyy-MM-dd` (Manila local date). */
  date: string;
  dailyPercent: number;
  pnl: number;
  deposits: number;
  withdrawals: number;
  /** Balance at end of day after deposits/withdrawals and trading P/L. */
  balance: number;
  isTradingDay: boolean;
}

export interface LedgerEntry {
  date: Date | string;
  // "DEPOSIT" | "WITHDRAWAL" — typed as string because SQLite stores enums as text.
  type: string;
  amount: number;
}

export interface PerformanceEntry {
  date: Date | string;
  dailyPercent: number;
}

/** Format a Date as a Manila-local `yyyy-MM-dd` string. */
export function toManilaDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // en-CA gives ISO-style yyyy-MM-dd formatting.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Today's date key in Manila time. */
export function manilaToday(): string {
  return toManilaDateKey(new Date());
}

/** Day of week for a `yyyy-MM-dd` key (0 = Sunday ... 6 = Saturday). */
function dayOfWeek(dateKey: string): number {
  // Parse as UTC noon to avoid any TZ rollover, then read weekday.
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.getUTCDay();
}

/** True when the date is a weekday (Mon–Fri), i.e. a trading day. */
export function isTradingDay(dateKey: string): boolean {
  const dow = dayOfWeek(dateKey);
  return dow >= 1 && dow <= 5;
}

/** Random daily percentage within the default estimate band. */
export function randomDailyPercent(
  min = DEFAULT_MIN_DAILY_PCT,
  max = DEFAULT_MAX_DAILY_PCT
): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

/** Add `n` calendar days to a `yyyy-MM-dd` key. */
export function addDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Return the most recent `count` trading days (Mon–Fri), ending on `endKey`
 * (inclusive if it is itself a trading day), oldest first.
 */
export function recentTradingDays(count: number, endKey = manilaToday()): string[] {
  const days: string[] = [];
  let cursor = endKey;
  while (days.length < count) {
    if (isTradingDay(cursor)) days.unshift(cursor);
    cursor = addDays(cursor, -1);
  }
  return days;
}

/**
 * Compound a full daily equity curve.
 *
 * Algorithm, walked day-by-day from `startDate` to the last known date:
 *   1. Apply that day's deposits (+) and withdrawals (−) to the balance first.
 *   2. If it's a trading day, apply the day's percentage to the post-cashflow
 *      balance to get P/L, and compound it in.
 * The opening balance is `initialDeposit`; it is the equity on `startDate`
 * before any same-day cashflow.
 */
export function computeEquityCurve(params: {
  initialDeposit: number;
  startDate: Date | string;
  ledger: LedgerEntry[];
  performances: PerformanceEntry[];
  /** Last date to compute up to. Defaults to latest performance/ledger date. */
  endDate?: Date | string;
}): EquityPoint[] {
  const { initialDeposit, startDate, ledger, performances } = params;

  const startKey = toManilaDateKey(startDate);

  // Index cashflows and percentages by date key.
  const depositsByDay = new Map<string, number>();
  const withdrawalsByDay = new Map<string, number>();
  for (const t of ledger) {
    const key = toManilaDateKey(t.date);
    if (t.type === "DEPOSIT") {
      depositsByDay.set(key, (depositsByDay.get(key) ?? 0) + t.amount);
    } else {
      withdrawalsByDay.set(key, (withdrawalsByDay.get(key) ?? 0) + t.amount);
    }
  }

  const pctByDay = new Map<string, number>();
  for (const p of performances) {
    pctByDay.set(toManilaDateKey(p.date), p.dailyPercent);
  }

  // Determine the end date.
  const candidateEnds = [
    params.endDate ? toManilaDateKey(params.endDate) : null,
    ...Array.from(pctByDay.keys()),
    ...Array.from(depositsByDay.keys()),
    ...Array.from(withdrawalsByDay.keys()),
    startKey,
  ].filter(Boolean) as string[];
  const endKey = candidateEnds.sort().at(-1)!;

  const points: EquityPoint[] = [];
  // Capital base = principal only (opening deposit ± cashflows). Daily P/L is a
  // FLAT calculation on this base — earnings do NOT compound back into it
  // (auto-compounding removed). Equity = capital base + accrued earnings.
  let capitalBase = initialDeposit;
  let cumulativePnl = 0;
  let cursor = startKey;

  while (cursor <= endKey) {
    const deposits = depositsByDay.get(cursor) ?? 0;
    const withdrawals = withdrawalsByDay.get(cursor) ?? 0;
    capitalBase += deposits - withdrawals;

    // 24h COOLING: capital that ARRIVED today — a new package deposit, or the
    // opening deposit on the account's first day — does not earn on its arrival
    // day; it starts accruing the NEXT calendar day (funds aren't traded yet).
    // Renewals aren't deposits (no ledger entry), so they keep earning with no
    // cooling; existing capital is unaffected. Daily accrual happens once at
    // end-of-day, so "not same day" is exactly the 24h+ rule at this granularity.
    const arrivedToday = deposits + (cursor === startKey ? initialDeposit : 0);
    const earningBase = Math.max(0, capitalBase - arrivedToday);

    // A day "trades" whenever it carries a recorded percentage. Performance is
    // credited every calendar day (Mon–Sun), so the presence of a stored
    // percent — not the weekday — decides whether returns are calculated.
    const traded = pctByDay.has(cursor);
    let pnl = 0;
    let dailyPercent = 0;
    if (traded) {
      dailyPercent = pctByDay.get(cursor)!;
      // Flat: daily P/L is calculated on Active Capital (excluding capital still
      // in its 24h cooling window), not the running balance.
      pnl = (earningBase * dailyPercent) / 100;
      cumulativePnl += pnl;
    }
    const balance = capitalBase + cumulativePnl;

    // Only record days that carry information (cashflow or a return) plus the
    // very first day, to keep the curve compact yet continuous.
    if (traded || deposits || withdrawals || cursor === startKey) {
      points.push({
        date: cursor,
        dailyPercent,
        pnl,
        deposits,
        withdrawals,
        balance,
        isTradingDay: traded,
      });
    }

    cursor = addDays(cursor, 1);
  }

  return points;
}

/** Aggregate KPI metrics derived from an equity curve + ledger. */
export interface PerformanceKpis {
  currentBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalNetPnl: number;
  winRate: number;
  avgDailyPercent: number;
  tradingDays: number;
}

export function computeKpis(params: {
  initialDeposit: number;
  ledger: LedgerEntry[];
  curve: EquityPoint[];
}): PerformanceKpis {
  const { initialDeposit, ledger, curve } = params;

  const depositTxns = ledger.filter((l) => l.type === "DEPOSIT");
  const withdrawalTxns = ledger.filter((l) => l.type === "WITHDRAWAL");

  // Total Deposits includes the opening balance.
  const totalDeposits =
    initialDeposit + depositTxns.reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = withdrawalTxns.reduce((s, t) => s + t.amount, 0);

  const tradingPoints = curve.filter((p) => p.isTradingDay && p.dailyPercent !== 0);
  const totalNetPnl = curve.reduce((s, p) => s + p.pnl, 0);
  const wins = tradingPoints.filter((p) => p.pnl > 0).length;
  const winRate = tradingPoints.length
    ? (wins / tradingPoints.length) * 100
    : 0;
  const avgDailyPercent = tradingPoints.length
    ? tradingPoints.reduce((s, p) => s + p.dailyPercent, 0) / tradingPoints.length
    : 0;

  const currentBalance = curve.length
    ? curve[curve.length - 1].balance
    : initialDeposit;

  return {
    currentBalance,
    totalDeposits,
    totalWithdrawals,
    totalNetPnl,
    winRate,
    avgDailyPercent,
    tradingDays: tradingPoints.length,
  };
}

export type EquityRange = "1W" | "1M" | "3M" | "YTD" | "ALL";

/** Slice an equity curve to a chart range, relative to the latest point. */
export function filterCurveByRange(curve: EquityPoint[], range: EquityRange): EquityPoint[] {
  if (range === "ALL" || curve.length === 0) return curve;
  const endKey = curve[curve.length - 1].date;

  let startKey: string;
  if (range === "YTD") {
    startKey = `${endKey.slice(0, 4)}-01-01`;
  } else {
    const back = range === "1W" ? 7 : range === "1M" ? 31 : 93;
    startKey = addDays(endKey, -back);
  }
  return curve.filter((p) => p.date >= startKey);
}
