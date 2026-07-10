/**
 * Capital-lock + Available-Withdrawal money model (Node runtime only).
 *
 * Reframes the existing numbers without changing the performance engine:
 *   - ACTIVE CAPITAL  = locked principal = approved deposits still within their
 *     6-month lock (maturity = deposit date + 6 months, extended per renewal),
 *     minus any matured principal the user has released.
 *   - AVAILABLE WITHDRAWAL = daily P/L + referral commissions earned + released
 *     matured principal − withdrawals already requested (pending/processing/
 *     completed) − legacy commission withdrawals. This is the withdrawable pool.
 *   - TOTAL EARNED = daily P/L + referral commissions.
 *
 * ACTIVE CAPITAL + net earnings reconciles to the old compounded balance.
 */
import { prisma } from "./prisma";

export const LOCK_MONTHS = 6;
export const WITHDRAWAL_FEE_PCT = 3;
export const MIN_WITHDRAWAL = 10;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Add whole months to a date (UTC), clamping day overflow. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // clamp e.g. Aug 31 → Feb
  return d;
}

export interface CapitalDeposit {
  id: string;
  amount: number;
  depositedAt: string;
  maturityDate: string;
  matured: boolean;
  daysToMaturity: number;
}

export interface CapitalSummary {
  activeCapital: number; // locked, not yet matured
  maturedCapital: number; // matured, awaiting withdraw/renew
  hasMatured: boolean;
  earliestMaturity: string | null;
  daysToMaturity: number | null;
  deposits: CapitalDeposit[];

  dailyPnl: number;
  commissionsEarned: number;
  totalEarned: number;
  totalWithdrawn: number;
  withdrawalsOutstanding: number;
  availableWithdrawal: number;
}

const DAY_MS = 24 * 60 * 60_000;

export async function getCapitalSummary(opts: {
  clientId: string;
  userId: string;
}): Promise<CapitalSummary> {
  const { clientId, userId } = opts;
  const now = Date.now();

  const [deposits, actions, perfAgg, commissionAgg, level2Agg, monthlyBonusAgg, withdrawals, legacyCw] = await Promise.all([
    prisma.transaction.findMany({
      where: { clientId, type: "DEPOSIT", status: "APPROVED" },
      select: { id: true, amount: true, date: true },
      orderBy: { date: "asc" },
    }),
    prisma.capitalAction.findMany({ where: { userId } }).catch(() => []),
    prisma.dailyPerformance.aggregate({ where: { clientId }, _sum: { pnlUsd: true } }),
    prisma.referralCommission
      .aggregate({ where: { referrerId: userId, status: "PAID" }, _sum: { commission: true } })
      .catch(() => ({ _sum: { commission: 0 } as { commission: number | null } })),
    prisma.level2Commission
      .aggregate({ where: { earnerId: userId }, _sum: { commissionAmount: true } })
      .catch(() => ({ _sum: { commissionAmount: 0 } as { commissionAmount: number | null } })),
    prisma.monthlyBonus
      .aggregate({ where: { userId }, _sum: { bonusAmount: true } })
      .catch(() => ({ _sum: { bonusAmount: 0 } as { bonusAmount: number | null } })),
    prisma.withdrawal
      .findMany({ where: { userId }, select: { amount: true, status: true } })
      .catch(() => [] as { amount: number; status: string }[]),
    prisma.commissionWithdrawal
      .findMany({ where: { userId }, select: { amount: true, status: true } })
      .catch(() => [] as { amount: number; status: string }[]),
  ]);

  const renewCount = new Map<string, number>();
  const withdrawnIds = new Set<string>();
  for (const a of actions) {
    if (a.action === "withdrawn") withdrawnIds.add(a.transactionId);
    else if (a.action === "renewed")
      renewCount.set(a.transactionId, (renewCount.get(a.transactionId) ?? 0) + 1);
  }

  let activeCapital = 0;
  let maturedCapital = 0;
  let releasedCapital = 0;
  let earliest: number | null = null;
  const depositList: CapitalDeposit[] = [];

  for (const d of deposits) {
    if (withdrawnIds.has(d.id)) {
      releasedCapital += d.amount;
      continue;
    }
    const maturity = addMonths(new Date(d.date), LOCK_MONTHS * (1 + (renewCount.get(d.id) ?? 0)));
    const maturedMs = maturity.getTime();
    const matured = maturedMs <= now;
    if (matured) maturedCapital += d.amount;
    else {
      activeCapital += d.amount;
      if (earliest === null || maturedMs < earliest) earliest = maturedMs;
    }
    depositList.push({
      id: d.id,
      amount: round2(d.amount),
      depositedAt: new Date(d.date).toISOString(),
      maturityDate: maturity.toISOString(),
      matured,
      daysToMaturity: Math.max(0, Math.ceil((maturedMs - now) / DAY_MS)),
    });
  }

  const dailyPnl = round2(perfAgg._sum.pnlUsd ?? 0);
  // Referral earnings = level-1 + level-2 (indirect) + monthly direct bonus.
  const commissionsEarned = round2(
    (commissionAgg._sum.commission ?? 0) +
      (level2Agg._sum.commissionAmount ?? 0) +
      (monthlyBonusAgg._sum.bonusAmount ?? 0)
  );
  const totalEarned = round2(dailyPnl + commissionsEarned);

  // Outstanding = anything not rejected still counts against the pool.
  const withdrawalsOutstanding = round2(
    withdrawals.filter((w) => w.status !== "rejected").reduce((s, w) => s + w.amount, 0) +
      legacyCw.filter((w) => w.status !== "REJECTED").reduce((s, w) => s + w.amount, 0)
  );
  const totalWithdrawn = round2(
    withdrawals.filter((w) => w.status === "completed").reduce((s, w) => s + w.amount, 0)
  );

  const availableWithdrawal = Math.max(
    0,
    round2(dailyPnl + commissionsEarned + releasedCapital - withdrawalsOutstanding)
  );

  return {
    activeCapital: round2(activeCapital),
    maturedCapital: round2(maturedCapital),
    hasMatured: maturedCapital > 0,
    earliestMaturity: earliest ? new Date(earliest).toISOString() : null,
    daysToMaturity: earliest ? Math.max(0, Math.ceil((earliest - now) / DAY_MS)) : null,
    deposits: depositList,
    dailyPnl,
    commissionsEarned,
    totalEarned,
    totalWithdrawn,
    withdrawalsOutstanding,
    availableWithdrawal,
  };
}

/** Validate a USDT payout address for the given network. */
export function isValidPayoutAddress(network: string, address: string): boolean {
  const a = address.trim();
  if (network === "USDT_BEP20") return /^0x[a-fA-F0-9]{40}$/.test(a);
  if (network === "USDT_TRC20") return /^T[A-Za-z1-9]{33}$/.test(a);
  return false;
}

export function computeFee(amount: number): { fee: number; receive: number } {
  const fee = round2((amount * WITHDRAWAL_FEE_PCT) / 100);
  return { fee, receive: round2(amount - fee) };
}

/**
 * Notify clients whose locked capital has just matured (idempotent — a
 * 'notified' CapitalAction marks each deposit so it's only emailed once).
 * Called from the daily cron.
 */
export async function runMaturityNotifications(): Promise<{ notified: number }> {
  const { notifyCapitalMatured } = await import("./mailers");
  const now = Date.now();

  const [deposits, actions] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: "DEPOSIT", status: "APPROVED" },
      select: { id: true, clientId: true, amount: true, date: true },
    }),
    prisma.capitalAction.findMany().catch(() => []),
  ]);

  const renew = new Map<string, number>();
  const withdrawn = new Set<string>();
  const notified = new Set<string>();
  for (const a of actions) {
    if (a.action === "withdrawn") withdrawn.add(a.transactionId);
    else if (a.action === "renewed") renew.set(a.transactionId, (renew.get(a.transactionId) ?? 0) + 1);
    else if (a.action === "notified") notified.add(a.transactionId);
  }

  const due = deposits.filter((d) => {
    if (withdrawn.has(d.id) || notified.has(d.id)) return false;
    const maturity = addMonths(new Date(d.date), LOCK_MONTHS * (1 + (renew.get(d.id) ?? 0)));
    return maturity.getTime() <= now;
  });
  if (due.length === 0) return { notified: 0 };

  const clientIds = Array.from(new Set(due.map((d) => d.clientId)));
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(clients.map((c) => [c.id, c]));

  let count = 0;
  for (const d of due) {
    const c = byId.get(d.clientId);
    if (c) {
      notifyCapitalMatured({ email: c.email, name: c.name, amount: d.amount }).catch(() => {});
    }
    await prisma.capitalAction
      .create({
        data: { transactionId: d.id, userId: "system", clientId: d.clientId, action: "notified", amount: d.amount },
      })
      .catch(() => {});
    count += 1;
  }
  return { notified: count };
}
