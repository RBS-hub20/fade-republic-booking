/**
 * Daily performance engine (Node runtime only).
 *
 * Runs once a day (23:59 Asia/Manila via Vercel Cron) and, for every funded
 * ACTIVE client, records a compounded daily return for each calendar day
 * (Mon–Sun) that isn't already logged — automatically backfilling any gap from
 * the last recorded day (or the client's first funding day) up to today.
 *
 *   - CLIENT return (shown on the dashboard + performance log): random 0.3–0.5%
 *     per day, compounded into the Current Balance.
 *   - SERVER return (internal gross Forex/Crypto, admin-only): random 1.0–2.0%,
 *     stored in DailyPerformance.notes ("server:1.73") so no schema migration is
 *     needed — kept separate from the client-facing percent.
 */
import { prisma } from "./prisma";
import { computeEquityCurve, toManilaDateKey, manilaToday, addDays } from "./performance";

export const CLIENT_MIN_PCT = 0.3;
export const CLIENT_MAX_PCT = 0.5;
export const SERVER_MIN_PCT = 1.0;
export const SERVER_MAX_PCT = 2.0;

function randPct(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

export interface DailyPerfResult {
  ok: true;
  upTo: string;
  daysCreated: number;
  clients: { name: string; added: number }[];
  at: string;
}

/**
 * Record/backfill daily performance for all funded clients up to `upToKey`
 * (defaults to today in Manila). Idempotent: days already logged are skipped.
 */
export async function runDailyPerformance(opts?: { upToKey?: string }): Promise<DailyPerfResult> {
  const today = opts?.upToKey ?? manilaToday();

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    include: {
      transactions: { where: { status: "APPROVED" }, orderBy: { date: "asc" } },
      dailyPerformances: { orderBy: { date: "asc" } },
    },
  });

  let daysCreated = 0;
  const report: { name: string; added: number }[] = [];

  for (const c of clients) {
    // A client only earns once funded — anchor the backfill to their first
    // approved deposit (or, if seeded, their existing performance history).
    const firstDeposit = c.transactions.find((t) => t.type === "DEPOSIT");
    const existingKeys = new Set(c.dailyPerformances.map((p) => toManilaDateKey(p.date)));
    const lastKey = c.dailyPerformances.length
      ? Array.from(existingKeys).sort().at(-1)!
      : null;

    let startKey: string | null = null;
    if (lastKey) startKey = addDays(lastKey, 1);
    else if (firstDeposit) startKey = toManilaDateKey(firstDeposit.date);
    if (!startKey || startKey > today) continue; // nothing to do / not funded yet

    // Assemble the full percent history (existing + freshly generated) so the
    // curve can compound end-of-day balances correctly, including deposits.
    const perfs = c.dailyPerformances.map((p) => ({
      date: toManilaDateKey(p.date),
      dailyPercent: p.dailyPercent,
    }));
    const newDays: { key: string; clientPct: number; serverPct: number }[] = [];
    for (let cur = startKey; cur <= today; cur = addDays(cur, 1)) {
      if (existingKeys.has(cur)) continue;
      const clientPct = randPct(CLIENT_MIN_PCT, CLIENT_MAX_PCT);
      newDays.push({ key: cur, clientPct, serverPct: randPct(SERVER_MIN_PCT, SERVER_MAX_PCT) });
      perfs.push({ date: cur, dailyPercent: clientPct });
    }
    if (newDays.length === 0) continue;

    const curve = computeEquityCurve({
      initialDeposit: c.initialDeposit,
      startDate: c.startDate,
      ledger: c.transactions.map((t) => ({ date: t.date, type: t.type, amount: t.amount })),
      performances: perfs,
      endDate: today,
    });
    const byKey = new Map(curve.map((p) => [p.date, p]));

    for (const d of newDays) {
      const pt = byKey.get(d.key);
      try {
        await prisma.dailyPerformance.create({
          data: {
            clientId: c.id,
            // Noon UTC = 20:00 Manila (same calendar day) → stable date key.
            date: new Date(`${d.key}T12:00:00.000Z`),
            dailyPercent: d.clientPct,
            balanceEOD: pt?.balance ?? c.initialDeposit,
            pnlUsd: pt?.pnl ?? 0,
            notes: `server:${d.serverPct}`,
          },
        });
        daysCreated += 1;
      } catch {
        // Unique (clientId, date) — a concurrent run already logged this day.
      }
    }
    report.push({ name: c.name, added: newDays.length });
  }

  return { ok: true, upTo: today, daysCreated, clients: report, at: new Date().toISOString() };
}
