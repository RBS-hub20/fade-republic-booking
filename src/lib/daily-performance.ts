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

  // Released-capital lookup (one batch) so we can skip INACTIVE accounts: a
  // client whose entire principal has been withdrawn earns no daily ROI until
  // they fund a new package.
  const withdrawnActions = await prisma.capitalAction
    .findMany({
      where: { clientId: { in: clients.map((c) => c.id) }, action: "withdrawn" },
      select: { transactionId: true },
    })
    .catch(() => [] as { transactionId: string }[]);
  const withdrawnSet = new Set(withdrawnActions.map((a) => a.transactionId));

  // 5x payout-cap inputs (one batch): map each client to its user and that
  // user's lifetime commission earnings, so we can stop ROI for CAPPED accounts
  // (earned across ALL income ≥ remaining capital × 5).
  const clientUsers = await prisma.user
    .findMany({ where: { clientId: { in: clients.map((c) => c.id) } }, select: { id: true, clientId: true } })
    .catch(() => [] as { id: string; clientId: string | null }[]);
  const userByClient = new Map(clientUsers.map((u) => [u.clientId, u.id]));
  const userIds = clientUsers.map((u) => u.id);
  const [l1g, l2g, mbg] = await Promise.all([
    userIds.length
      ? prisma.referralCommission
          .groupBy({ by: ["referrerId"], where: { referrerId: { in: userIds }, status: "PAID" }, _sum: { commission: true } })
          .catch(() => [] as { referrerId: string; _sum: { commission: number | null } }[])
      : [],
    userIds.length
      ? prisma.level2Commission
          .groupBy({ by: ["earnerId"], where: { earnerId: { in: userIds } }, _sum: { commissionAmount: true } })
          .catch(() => [] as { earnerId: string; _sum: { commissionAmount: number | null } }[])
      : [],
    userIds.length
      ? prisma.monthlyBonus
          .groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _sum: { bonusAmount: true } })
          .catch(() => [] as { userId: string; _sum: { bonusAmount: number | null } }[])
      : [],
  ]);
  const commByUser = new Map<string, number>();
  for (const g of l1g) commByUser.set(g.referrerId, (commByUser.get(g.referrerId) ?? 0) + (g._sum.commission ?? 0));
  for (const g of l2g) commByUser.set(g.earnerId, (commByUser.get(g.earnerId) ?? 0) + (g._sum.commissionAmount ?? 0));
  for (const g of mbg) commByUser.set(g.userId, (commByUser.get(g.userId) ?? 0) + (g._sum.bonusAmount ?? 0));

  let daysCreated = 0;
  const report: { name: string; added: number }[] = [];

  for (const c of clients) {
    // INACTIVE gate: no remaining locked principal → no daily ROI.
    const remainingPrincipal = c.transactions.reduce(
      (s, t) => s + (t.type === "DEPOSIT" && !withdrawnSet.has(t.id) ? t.amount : 0),
      0
    );
    if (remainingPrincipal <= 0) continue;

    // CAPPED gate: total earned (daily ROI so far + all commissions) has hit the
    // 5x cap → stop earning until they add/renew capital.
    const uid = userByClient.get(c.id);
    const priorPnl = c.dailyPerformances.reduce((s, p) => s + p.pnlUsd, 0);
    const totalEarned = priorPnl + (uid ? commByUser.get(uid) ?? 0 : 0);
    if (remainingPrincipal * 5 <= totalEarned) continue;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run the daily engine with in-invocation retries. Vercel Hobby only allows a
 * single daily cron (so we can't schedule 10-minute retry crons), and each
 * invocation is time-bounded — so we retry a few times within the same run to
 * ride out transient DB blips. Any night that still fails is self-healed on the
 * next run, since the engine always backfills from the last logged day.
 */
export async function runDailyPerformanceResilient(opts?: {
  upToKey?: string;
  attempts?: number;
  delayMs?: number;
}): Promise<DailyPerfResult> {
  const attempts = opts?.attempts ?? 3;
  const delayMs = opts?.delayMs ?? 1500;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await runDailyPerformance({ upToKey: opts?.upToKey });
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr;
}

/** Days between two `yyyy-MM-dd` keys (b − a), positive when b is later. */
function dayDiff(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T12:00:00Z`).getTime();
  const b = new Date(`${bKey}T12:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60_000));
}

export interface DailyPerfHealth {
  ok: boolean;
  lastPostedKey: string | null; // newest posted day across funded clients
  expectedKey: string; // today (Manila)
  yesterdayKey: string; // last day that should already be posted
  stale: boolean; // ≥1 funded client is missing yesterday's post
  daysBehind: number; // how far the newest post lags behind yesterday
  fundedClients: number; // clients due at least one post
  clientsBehind: number; // funded clients missing yesterday
  at: string;
}

/**
 * Monitoring snapshot for the daily P/L job. "Stale" means at least one funded
 * client is missing YESTERDAY's entry — today's is allowed to be absent until
 * the 23:59 PHT run.
 */
export async function getDailyPerfHealth(): Promise<DailyPerfHealth> {
  const today = manilaToday();
  const yesterday = addDays(today, -1);

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: {
      transactions: {
        where: { status: "APPROVED", type: "DEPOSIT" },
        select: { date: true },
        orderBy: { date: "asc" },
        take: 1,
      },
      dailyPerformances: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
    },
  });

  let lastPostedKey: string | null = null;
  let fundedClients = 0;
  let clientsBehind = 0;
  for (const c of clients) {
    const firstDep = c.transactions[0]?.date;
    if (!firstDep) continue; // not funded → nothing due
    if (toManilaDateKey(firstDep) > yesterday) continue; // funded today, nothing due yet
    fundedClients += 1;
    const last = c.dailyPerformances[0] ? toManilaDateKey(c.dailyPerformances[0].date) : null;
    if (last && (lastPostedKey === null || last > lastPostedKey)) lastPostedKey = last;
    if (!last || last < yesterday) clientsBehind += 1;
  }

  const stale = clientsBehind > 0;
  const daysBehind = lastPostedKey
    ? Math.max(0, dayDiff(lastPostedKey, yesterday))
    : fundedClients > 0
    ? Math.max(1, dayDiff(addDays(yesterday, -1), yesterday))
    : 0;

  return {
    ok: !stale,
    lastPostedKey,
    expectedKey: today,
    yesterdayKey: yesterday,
    stale,
    daysBehind,
    fundedClients,
    clientsBehind,
    at: new Date().toISOString(),
  };
}
