/**
 * Trading-day gate — QuantumX posts daily P/L on TRADING DAYS ONLY (Mon–Fri by
 * default, Asia/Manila), like real markets. Saturday & Sunday are "No Trading —
 * Market Offline": no P/L is accrued and no row is posted (the log shows "—",
 * not 0%).
 *
 * Client-safe: pure date math, no prisma / Node-only APIs, so both server jobs
 * and UI can import it.
 *
 * Configurable via PNL_TRADING_DAYS (comma-separated day numbers, 0=Sun..6=Sat).
 * Default: "1,2,3,4,5" (Mon–Fri).
 */

/** Consistent copy used everywhere a weekend is surfaced. */
export const MARKET_OFFLINE_MESSAGE = "No Trading — Market Offline";
export const MARKET_OFFLINE_SUBTEXT = "Market closed Sat–Sun — resumes Monday 00:00 Asia/Manila";
export const MARKET_OFFLINE_NOTE = "Market closed — Weekend — resumes Monday";
/** The synthetic (display-only) row type for a weekend gap. */
export const MARKET_OFFLINE_TYPE = "MARKET_OFFLINE";

/** Add `n` calendar days to a "YYYY-MM-DD" key. */
export function addDaysKey(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Non-trading (weekend) calendar keys within [fromKey, toKey] that aren't
 * already present. Display-only: use to inject "Market Offline" rows into a
 * statement/ledger without ever writing them to the DB.
 */
export function marketOfflineKeysBetween(
  fromKey: string,
  toKey: string,
  existing?: Set<string>
): string[] {
  if (!fromKey || !toKey || fromKey > toKey) return [];
  const out: string[] = [];
  // Safety bound: never fill more than ~2 years of keys.
  let guard = 0;
  for (let k = fromKey; k <= toKey && guard < 800; k = addDaysKey(k, 1), guard++) {
    if (!isTradingDayKey(k) && !existing?.has(k)) out.push(k);
  }
  return out;
}

function parseTradingDays(raw: string | undefined): number[] {
  if (!raw) return [1, 2, 3, 4, 5];
  const days = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length ? Array.from(new Set(days)) : [1, 2, 3, 4, 5];
}

/** Days the market trades (0=Sun..6=Sat). Mon–Fri unless overridden by env. */
export const PNL_TRADING_DAYS: number[] = parseTradingDays(process.env.PNL_TRADING_DAYS);

/** Day-of-week (0=Sun..6=Sat) in Asia/Manila for a given instant (default now). */
export function manilaDayOfWeek(now: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? now.getUTCDay();
}

/** Day-of-week (0=Sun..6=Sat) for a Manila calendar key "YYYY-MM-DD". */
export function dayOfWeekForKey(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

export function isTradingDay(day: number): boolean {
  return PNL_TRADING_DAYS.includes(day);
}

/** True when the given Manila calendar key ("YYYY-MM-DD") is a trading day. */
export function isTradingDayKey(key: string): boolean {
  return isTradingDay(dayOfWeekForKey(key));
}

/** True when "right now" (Asia/Manila) is a trading day. */
export function isTradingNow(now: Date = new Date()): boolean {
  return isTradingDay(manilaDayOfWeek(now));
}

/**
 * Most recent trading day on-or-before `key` (walks back up to 7 days). Used by
 * the P/L health check so a weekend never counts as a "missing" post.
 */
export function previousTradingDayKey(key: string): string {
  let cur = key;
  for (let i = 0; i < 7; i++) {
    if (isTradingDayKey(cur)) return cur;
    const d = new Date(`${cur}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    cur = d.toISOString().slice(0, 10);
  }
  return cur;
}
