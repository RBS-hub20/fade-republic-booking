/**
 * Admin-only "fund performance" aggregation: the internal SERVER gross return
 * (1–2%/day, stored in DailyPerformance.notes as "server:1.73") versus the
 * CLIENT payout (0.3–0.5%/day, the dailyPercent shown to clients), and the
 * margin the fund keeps.
 *
 * Server gross on a client's capital that day = opening balance * serverPct%,
 * where opening balance = balanceEOD − client pnl. Margin = gross − payout.
 */
import { prisma } from "./prisma";
import { toManilaDateKey, manilaToday, addDays } from "./performance";

export interface DayAgg {
  date: string; // yyyy-MM-dd (Manila)
  clients: number;
  avgServerPct: number;
  avgClientPct: number;
  grossUsd: number;
  payoutUsd: number;
  marginUsd: number;
}

export interface PeriodTotals {
  grossUsd: number;
  payoutUsd: number;
  marginUsd: number;
  avgServerPct: number;
  avgClientPct: number;
  marginPct: number; // margin / gross
  days: number;
}

export interface ServerPerformanceSummary {
  today: DayAgg | null;
  last7: PeriodTotals;
  last30: PeriodTotals;
  days: DayAgg[]; // recent days, newest first
}

/** Parse the internal server percent out of a DailyPerformance note. */
function parseServerPct(notes: string | null): number | null {
  if (!notes) return null;
  const m = /server:([\d.]+)/.exec(notes);
  return m ? Number(m[1]) : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function totals(days: DayAgg[]): PeriodTotals {
  const grossUsd = round2(days.reduce((s, d) => s + d.grossUsd, 0));
  const payoutUsd = round2(days.reduce((s, d) => s + d.payoutUsd, 0));
  const marginUsd = round2(grossUsd - payoutUsd);
  const withServer = days.filter((d) => d.avgServerPct > 0);
  const avgServerPct = withServer.length
    ? round2(withServer.reduce((s, d) => s + d.avgServerPct, 0) / withServer.length)
    : 0;
  const avgClientPct = days.length
    ? round2(days.reduce((s, d) => s + d.avgClientPct, 0) / days.length)
    : 0;
  return {
    grossUsd,
    payoutUsd,
    marginUsd,
    avgServerPct,
    avgClientPct,
    marginPct: grossUsd > 0 ? round2((marginUsd / grossUsd) * 100) : 0,
    days: days.length,
  };
}

export async function getServerPerformanceSummary(): Promise<ServerPerformanceSummary> {
  const since = new Date(`${addDays(manilaToday(), -34)}T00:00:00.000Z`);
  const rows = await prisma.dailyPerformance.findMany({
    where: { date: { gte: since } },
    select: { date: true, dailyPercent: true, pnlUsd: true, balanceEOD: true, notes: true },
    orderBy: { date: "asc" },
  });

  // Bucket by Manila day.
  const byDay = new Map<
    string,
    { clients: number; serverPcts: number[]; clientPcts: number[]; gross: number; payout: number }
  >();
  for (const r of rows) {
    // Only server-tracked days count. Legacy/seeded rows without a server %
    // predate this system and would distort the margin (payout with no gross).
    const serverPct = parseServerPct(r.notes);
    if (serverPct == null) continue;

    const key = toManilaDateKey(r.date);
    const bucket =
      byDay.get(key) ?? { clients: 0, serverPcts: [], clientPcts: [], gross: 0, payout: 0 };
    bucket.clients += 1;
    bucket.clientPcts.push(r.dailyPercent);
    bucket.payout += r.pnlUsd;
    bucket.serverPcts.push(serverPct);
    const opening = r.balanceEOD - r.pnlUsd; // capital the return applied to
    bucket.gross += (opening * serverPct) / 100;
    byDay.set(key, bucket);
  }

  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const days: DayAgg[] = Array.from(byDay.entries())
    .map(([date, b]) => ({
      date,
      clients: b.clients,
      avgServerPct: round2(avg(b.serverPcts)),
      avgClientPct: round2(avg(b.clientPcts)),
      grossUsd: round2(b.gross),
      payoutUsd: round2(b.payout),
      marginUsd: round2(b.gross - b.payout),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  const todayKey = manilaToday();
  const today = days.find((d) => d.date === todayKey) ?? null;
  const last7 = totals(days.slice(0, 7));
  const last30 = totals(days.slice(0, 30));

  return { today, last7, last30, days };
}
