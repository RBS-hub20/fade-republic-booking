/**
 * Referral program core (Node runtime only).
 *
 * Model:
 *  - Every user has a unique `referralCode` (first 4 letters of name + 3 digits).
 *  - New signups may pass `?ref=CODE`, tagging them to a referrer.
 *  - Whenever a referred user activates a QX Tier package — a new purchase OR a
 *    renewal — the referrer earns a commission based on the referrer's OWN tier
 *    at that moment. Commissions are UNLIMITED (one per event, not one per
 *    referral). An INACTIVE referrer (all capital withdrawn) is skipped.
 *  - Commissions are credited INSTANTLY as PAID to the referrer's withdrawable
 *    `commissionBalance` (no pending / 24h hold).
 */
import { prisma } from "./prisma";
import { getClientPerformance } from "./data";
import { TIERS, tierForBalance, type TierId } from "./tiers";
import { REFERRALS_ENABLED } from "./referrals-config";
import { ensureReferralSchemaOnce } from "./referral-schema";
import { canEarn } from "./payout-cap";

/** Commission percentage a referrer earns, keyed by their current tier. */
export const COMMISSION_RATES: Record<"none" | TierId, number> = {
  none: 5,
  bronze: 5,
  silver: 6,
  gold: 7,
  platinum: 8,
};

export const MIN_COMMISSION_WITHDRAWAL = 10;

/** 2nd-level (indirect) commission %, keyed by the EARNER's current tier. */
export const LEVEL2_RATES: Record<"none" | TierId, number> = {
  none: 0.5,
  bronze: 0.5,
  silver: 1,
  gold: 2,
  platinum: 3,
};

// 2nd-level unlock requirements.
const DIRECTS_REQUIRED = 3;
const ACTIVE_DIRECT_MIN_CAPITAL = 50;
const MAX_UPLINE_WALK = 20; // compression cap when finding a qualified upline

/** Commission % for a given balance-derived tier (None/Bronze both 5%). */
export function commissionRateForBalance(balance: number): number {
  const tier = tierForBalance(balance);
  return COMMISSION_RATES[tier?.id ?? "none"];
}

/** 2nd-level commission % for a given balance-derived tier. */
export function level2RateForBalance(balance: number): number {
  const tier = tierForBalance(balance);
  return LEVEL2_RATES[tier?.id ?? "none"];
}

async function balanceOfUser(clientId: string | null | undefined): Promise<number> {
  if (!clientId) return 0;
  const perf = await getClientPerformance(clientId).catch(() => null);
  return perf?.kpis.currentBalance ?? 0;
}

/**
 * Recompute a user's 2nd-level unlock: they qualify with 3+ DIRECT referrals
 * that each have Active Capital ≥ $50 AND an ACTIVE client. Locks again
 * automatically if they drop below the threshold. Returns the unlock state.
 */
export async function recomputeUnlock(userId: string): Promise<boolean> {
  await ensureReferralSchemaOnce(prisma);
  const directs = await prisma.user.findMany({
    where: { referredById: userId },
    select: { clientId: true },
  });
  const clientIds = directs.map((d) => d.clientId).filter(Boolean) as string[];

  let count = 0;
  if (clientIds.length) {
    const [activeClients, deposits] = await Promise.all([
      prisma.client.findMany({ where: { id: { in: clientIds }, status: "ACTIVE" }, select: { id: true } }),
      prisma.transaction.groupBy({
        by: ["clientId"],
        where: { clientId: { in: clientIds }, type: "DEPOSIT", status: "APPROVED" },
        _sum: { amount: true },
      }),
    ]);
    const activeSet = new Set(activeClients.map((c) => c.id));
    for (const d of deposits) {
      if (activeSet.has(d.clientId) && (d._sum.amount ?? 0) >= ACTIVE_DIRECT_MIN_CAPITAL) count += 1;
    }
  }

  const unlocked = count >= DIRECTS_REQUIRED;
  const existing = await prisma.userUnlock.findUnique({ where: { userId } }).catch(() => null);
  await prisma.userUnlock.upsert({
    where: { userId },
    update: {
      level2Unlocked: unlocked,
      activeDirectsCount: count,
      unlockedAt: unlocked ? existing?.unlockedAt ?? new Date() : null,
    },
    create: {
      userId,
      level2Unlocked: unlocked,
      activeDirectsCount: count,
      unlockedAt: unlocked ? new Date() : null,
    },
  });
  return unlocked;
}

/** Daily cron: recompute unlock status for every user who has referrals. */
export async function recomputeAllUnlocks(): Promise<{ updated: number }> {
  await ensureReferralSchemaOnce(prisma);
  const uplines = await prisma.user.findMany({
    where: { referrals: { some: {} } },
    select: { id: true },
  });
  let updated = 0;
  for (const u of uplines) {
    await recomputeUnlock(u.id).catch(() => {});
    updated += 1;
  }
  return { updated };
}

/**
 * Uplines strictly ABOVE the direct referrer, ordered NEAREST-first
 * (grandparent → root). Prefers the source user's materialized `referralPath`
 * (one split, no walking); falls back to a `referredById` chain walk for users
 * created before genealogy backfill.
 */
async function uplinesAboveDirect(
  sourceUserId: string,
  directUplineId: string,
  sourceReferralPath: string | null
): Promise<string[]> {
  if (sourceReferralPath) {
    // path = [root, …, grandparent, directUpline]; drop the direct upline and
    // the source itself, then reverse to nearest-first.
    return sourceReferralPath
      .split("/")
      .filter((id) => id && id !== directUplineId && id !== sourceUserId)
      .reverse();
  }
  // Fallback: walk referredById upward from the direct referrer's parent.
  const ids: string[] = [];
  const seen = new Set<string>([sourceUserId, directUplineId]);
  const direct = await prisma.user
    .findUnique({ where: { id: directUplineId }, select: { referredById: true } })
    .catch(() => null);
  let cursor: string | null = direct?.referredById ?? null;
  for (let i = 0; i < MAX_UPLINE_WALK && cursor; i++) {
    if (seen.has(cursor)) break; // cycle guard
    seen.add(cursor);
    ids.push(cursor);
    const u: { referredById: string | null } | null = await prisma.user
      .findUnique({ where: { id: cursor }, select: { referredById: true } })
      .catch(() => null);
    cursor = u?.referredById ?? null;
  }
  return ids;
}

/**
 * Credit the 2nd-level (indirect) commission for a source user's package
 * (purchase OR renewal). UNLIMITED — paid on every qualifying event, not just
 * the first. Uses the source user's lineage to find the nearest UNLOCKED upline
 * above the direct referrer (compression), and pays them `level2Rate(theirTier)
 * × packageAmount`. Skips the payout if that upline is INACTIVE (no capital).
 */
async function creditLevel2Commission(opts: {
  sourceUserId: string;
  directUplineId: string;
  sourceReferralPath: string | null; // source user's path: root → direct upline
  packageAmount: number;
}): Promise<void> {
  const candidates = await uplinesAboveDirect(
    opts.sourceUserId,
    opts.directUplineId,
    opts.sourceReferralPath
  );
  if (candidates.length === 0) return; // no upline above the direct referrer

  // Compression: nearest UNLOCKED upline wins — resolved in ONE batch query.
  const unlocked = await prisma.userUnlock
    .findMany({
      where: { userId: { in: candidates }, level2Unlocked: true },
      select: { userId: true },
    })
    .catch(() => [] as { userId: string }[]);
  const unlockedSet = new Set(unlocked.map((u) => u.userId));
  const earnerId = candidates.find((id) => unlockedSet.has(id));
  if (!earnerId) return; // no qualified upline in the chain

  const earner = await prisma.user.findUnique({
    where: { id: earnerId },
    select: { id: true, clientId: true },
  });
  if (!earner) return;

  // Earning gate: an INACTIVE (no capital) or CAPPED (5x reached) upline
  // forfeits the L2 commission.
  const gate = await canEarn(earner.id, earner.clientId);
  if (!gate.allowed) return;

  const balance = await balanceOfUser(earner.clientId);
  const tier = tierForBalance(balance);
  const rate = LEVEL2_RATES[tier?.id ?? "none"];
  const commissionAmount = Math.round(opts.packageAmount * (rate / 100) * 100) / 100;
  if (commissionAmount <= 0) return;

  await prisma.$transaction([
    prisma.level2Commission.create({
      data: {
        earnerId: earner.id,
        sourceUserId: opts.sourceUserId,
        directUplineId: opts.directUplineId,
        depositAmount: opts.packageAmount,
        commissionRate: rate,
        commissionAmount,
        uplineTierAtTime: tier?.name ?? "None",
      },
    }),
    prisma.user.update({
      where: { id: earner.id },
      data: { commissionBalance: { increment: commissionAmount } },
    }),
  ]);
}

/** Build a referral code: first 4 alpha chars of the name, uppercased, + 3 digits. */
function buildCode(name: string): string {
  const letters = (name.replace(/[^a-zA-Z]/g, "").toUpperCase() + "USER").slice(0, 4);
  const digits = String(Math.floor(100 + Math.random() * 900)); // 100–999
  return `${letters}${digits}`;
}

/**
 * Ensure a user has a referral code, generating a unique one if missing.
 * Returns the code. Safe to call on every dashboard load.
 */
export async function ensureReferralCode(user: { id: string; name: string; referralCode: string | null }): Promise<string> {
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 6; i++) {
    const code = buildCode(user.name);
    const clash = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!clash) {
      await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
      return code;
    }
  }
  // Extremely unlikely fallback — guarantee uniqueness with a timestamp suffix.
  const code = `${buildCode(user.name)}${Date.now().toString().slice(-2)}`;
  await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
  return code;
}

/** Resolve a referrer's user id from a referral code (case-insensitive). */
export async function findReferrerByCode(code: string): Promise<string | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const ref = await prisma.user.findUnique({ where: { referralCode: clean } });
  return ref?.id ?? null;
}

/**
 * Credit referral commissions when a client activates a package — on EVERY
 * qualifying event (new purchase OR renewal), not just the first. Level 1 pays
 * the direct referrer; level 2 pays the nearest unlocked upline. Both credit
 * INSTANTLY to the withdrawable commissionBalance (unchanged credit flow).
 *
 * Skips a payout when the would-be earner is INACTIVE (all capital withdrawn).
 * Best-effort and fully guarded: crediting must never break the trigger.
 */
export async function creditPackageCommission(opts: {
  clientId: string;
  amount: number;
  /** What triggered this — for labelling only. Defaults to "purchase". */
  event?: "purchase" | "renewal";
}): Promise<void> {
  if (!REFERRALS_ENABLED) return;
  try {
    await ensureReferralSchemaOnce(prisma);

    // Which package did they activate? Must be at least Bronze ($50).
    const tier = tierForBalance(opts.amount);
    if (!tier) return; // below the lowest tier — not a package activation

    const referred = await prisma.user.findUnique({ where: { clientId: opts.clientId } });
    if (!referred || !referred.referredById) return; // not referred

    // Referrer's rate is based on THEIR tier at purchase time.
    const referrer = await prisma.user.findUnique({ where: { id: referred.referredById } });
    if (!referrer) return;

    // Earning gate: an INACTIVE (no capital) or CAPPED (5x reached) referrer
    // forfeits the L1 commission.
    const gate = await canEarn(referrer.id, referrer.clientId);
    if (gate.allowed) {
      const referrerBalance = await balanceOfUser(referrer.clientId);
      const rate = commissionRateForBalance(referrerBalance);
      const commission = Math.round(tier.price * (rate / 100) * 100) / 100;
      const label = `${tier.name} $${tier.price}${opts.event === "renewal" ? " · Renewal" : ""}`;

      // INSTANT credit (level 1): record the commission as PAID and add it to the
      // referrer's withdrawable balance immediately — no pending, no 24h delay.
      if (commission > 0) {
        await prisma.$transaction([
          prisma.referralCommission.create({
            data: {
              referrerId: referrer.id,
              referredUserId: referred.id,
              referredName: referred.name,
              packageLabel: label,
              packageAmount: tier.price,
              commission,
              status: "PAID",
              paidAt: new Date(),
            },
          }),
          prisma.user.update({
            where: { id: referrer.id },
            data: { commissionBalance: { increment: commission } },
          }),
        ]);
      }
    }

    // Level 2 (indirect): pay the nearest UNLOCKED upline above the referrer,
    // resolved from the source user's materialized lineage path. Independent of
    // the level-1 skip — a qualified upline still earns even if the direct
    // referrer is inactive.
    await creditLevel2Commission({
      sourceUserId: referred.id,
      directUplineId: referrer.id,
      sourceReferralPath: referred.referralPath,
      packageAmount: tier.price,
    });

    // The referrer just gained a (potentially) qualifying active direct —
    // refresh their unlock so they can start earning level-2 promptly.
    await recomputeUnlock(referrer.id).catch(() => {});
  } catch (e) {
    // Commission crediting must never break a deposit approval.
    console.error("creditPackageCommission failed (ignored):", e);
  }
}

/**
 * Settle any lingering PENDING commissions (created before instant crediting was
 * introduced) → PAID, crediting the withdrawable balance immediately. New
 * commissions are already PAID on creation, so this only migrates legacy rows.
 */
export async function settlePendingCommissions(referrerId: string): Promise<void> {
  const pending = await prisma.referralCommission.findMany({
    where: { referrerId, status: "PENDING" },
  });
  if (pending.length === 0) return;
  const total = pending.reduce((s, c) => s + c.commission, 0);
  await prisma.$transaction([
    prisma.referralCommission.updateMany({
      where: { id: { in: pending.map((d) => d.id) } },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.user.update({
      where: { id: referrerId },
      data: { commissionBalance: { increment: total } },
    }),
  ]);
}

export interface ReferralSummary {
  code: string;
  link: string;
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;
  commissionRate: number;
  totalEarned: number;
  commissionBalance: number;
  tierName: string;
  // 2nd-level compensation.
  level2Unlocked: boolean;
  level2Rate: number;
  activeDirects: number;
  directsRequired: number;
  level2Earned: number;
  // Monthly direct-referral bonus.
  monthlyBonusEarned: number;
  lastMonthlyBonus: { monthYear: string; amount: number } | null;
  history: {
    id: string;
    date: string;
    referredName: string;
    packageLabel: string;
    commission: number;
    status: "PENDING" | "PAID";
  }[];
}

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://quantumxglobal.online";

/**
 * Assemble everything the dashboard referral panel needs for one user.
 *
 * Fully defensive: returns `null` (so the caller hides the panel) if referrals
 * are disabled or a referral code can't be provisioned, and each table-dependent
 * query degrades to an empty/zero value on its own — so a lagging migration
 * (columns present, tables missing) can NEVER throw or crash the dashboard.
 */
export async function getReferralSummary(user: {
  id: string;
  name: string;
  referralCode: string | null;
  commissionBalance: number;
  clientId: string | null;
}): Promise<ReferralSummary | null> {
  if (!REFERRALS_ENABLED) return null;

  // A working code is the one hard requirement — without it the link is useless.
  let code = await ensureReferralCode(user).catch(() => null);
  if (!code) {
    // Likely the referral columns aren't migrated — self-heal once, then retry.
    await ensureReferralSchemaOnce(prisma);
    code = await ensureReferralCode(user).catch(() => null);
    if (!code) return null;
  }

  // Each of these degrades independently; a missing table just yields zeros.
  await settlePendingCommissions(user.id).catch(() => {});

  const [totalReferrals, commissions, fresh, level2Agg, unlock, monthlyBonusAgg, lastBonus] =
    await Promise.all([
    prisma.user.count({ where: { referredById: user.id } }).catch(() => 0),
    prisma.referralCommission
      .findMany({ where: { referrerId: user.id }, orderBy: { createdAt: "desc" } })
      .catch(() => [] as Awaited<ReturnType<typeof prisma.referralCommission.findMany>>),
    prisma.user
      .findUnique({ where: { id: user.id }, select: { commissionBalance: true } })
      .catch(() => null),
    prisma.level2Commission
      .aggregate({ where: { earnerId: user.id }, _sum: { commissionAmount: true } })
      .catch(() => ({ _sum: { commissionAmount: 0 } as { commissionAmount: number | null } })),
    prisma.userUnlock.findUnique({ where: { userId: user.id } }).catch(() => null),
    prisma.monthlyBonus
      .aggregate({ where: { userId: user.id }, _sum: { bonusAmount: true } })
      .catch(() => ({ _sum: { bonusAmount: 0 } as { bonusAmount: number | null } })),
    prisma.monthlyBonus
      .findFirst({ where: { userId: user.id }, orderBy: { monthYear: "desc" } })
      .catch(() => null),
  ]);

  let balance = 0;
  if (user.clientId) {
    const perf = await getClientPerformance(user.clientId).catch(() => null);
    balance = perf?.kpis.currentBalance ?? 0;
  }
  const tier = tierForBalance(balance);

  const paid = commissions.filter((c) => c.status === "PAID");
  const pending = commissions.filter((c) => c.status === "PENDING");
  // Commissions are unlimited (repeats per referral), so "active/pending
  // referrals" must count DISTINCT referred users, not commission rows.
  const activeReferralCount = new Set(paid.map((c) => c.referredUserId)).size;
  const pendingReferralCount = new Set(pending.map((c) => c.referredUserId)).size;
  const level2Earned = Math.round((level2Agg._sum.commissionAmount ?? 0) * 100) / 100;
  const monthlyBonusEarned = Math.round((monthlyBonusAgg._sum.bonusAmount ?? 0) * 100) / 100;

  return {
    code,
    link: `${APP_ORIGIN}/signup?ref=${code}`,
    totalReferrals,
    activeReferrals: activeReferralCount,
    pendingReferrals: pendingReferralCount,
    commissionRate: commissionRateForBalance(balance),
    totalEarned:
      Math.round(
        (paid.reduce((s, c) => s + c.commission, 0) + level2Earned + monthlyBonusEarned) * 100
      ) / 100,
    commissionBalance: fresh?.commissionBalance ?? user.commissionBalance ?? 0,
    tierName: tier?.name ?? "None",
    level2Unlocked: unlock?.level2Unlocked ?? false,
    level2Rate: level2RateForBalance(balance),
    activeDirects: unlock?.activeDirectsCount ?? 0,
    directsRequired: DIRECTS_REQUIRED,
    level2Earned,
    monthlyBonusEarned,
    lastMonthlyBonus: lastBonus
      ? { monthYear: lastBonus.monthYear, amount: Math.round(lastBonus.bonusAmount * 100) / 100 }
      : null,
    history: commissions.map((c) => ({
      id: c.id,
      date: c.createdAt.toISOString(),
      referredName: c.referredName,
      packageLabel: c.packageLabel,
      commission: c.commission,
      status: c.status === "PAID" ? "PAID" : "PENDING",
    })),
  };
}

export interface ReferralBonusEvent {
  /** Manila date key (YYYY-MM-DD) for interleaving into the daily log. */
  dateKey: string;
  /** ISO timestamp. */
  date: string;
  amount: number;
  /** Downline the bonus came from (username, falling back to display name). */
  fromName: string;
  level: 1 | 2;
}

/**
 * All referral commission events a user has EARNED (level 1 + level 2), newest
 * first, with the source downline's username resolved — for interleaving
 * "+$X.XX Referral Bonus from @user" rows into the Daily Performance Log.
 * Fully defensive: any missing table degrades to an empty list.
 */
export async function getReferralBonusEvents(userId: string): Promise<ReferralBonusEvent[]> {
  const { toManilaDateKey } = await import("./performance");
  const [l1, l2] = await Promise.all([
    prisma.referralCommission
      .findMany({
        where: { referrerId: userId, status: "PAID" },
        select: { createdAt: true, commission: true, referredUserId: true, referredName: true },
      })
      .catch(() => [] as { createdAt: Date; commission: number; referredUserId: string; referredName: string }[]),
    prisma.level2Commission
      .findMany({
        where: { earnerId: userId },
        select: { createdAt: true, commissionAmount: true, sourceUserId: true },
      })
      .catch(() => [] as { createdAt: Date; commissionAmount: number; sourceUserId: string }[]),
  ]);

  const ids = Array.from(new Set([...l1.map((r) => r.referredUserId), ...l2.map((r) => r.sourceUserId)]));
  const users = ids.length
    ? await prisma.user
        .findMany({ where: { id: { in: ids } }, select: { id: true, username: true, name: true } })
        .catch(() => [] as { id: string; username: string | null; name: string }[])
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.username || u.name]));

  const events: ReferralBonusEvent[] = [
    ...l1.map((r) => ({
      dateKey: toManilaDateKey(r.createdAt),
      date: r.createdAt.toISOString(),
      amount: Math.round(r.commission * 100) / 100,
      fromName: nameById.get(r.referredUserId) || r.referredName,
      level: 1 as const,
    })),
    ...l2.map((r) => ({
      dateKey: toManilaDateKey(r.createdAt),
      date: r.createdAt.toISOString(),
      amount: Math.round(r.commissionAmount * 100) / 100,
      fromName: nameById.get(r.sourceUserId) || "a downline",
      level: 2 as const,
    })),
  ];
  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  return events;
}

/** Example-calculator amount for the "Silver $100" illustration. */
export function exampleCommission(rate: number): number {
  const silver = TIERS.find((t) => t.id === "silver")!;
  return Math.round(silver.price * (rate / 100) * 100) / 100;
}

// ===================== Monthly direct-referral bonus =====================

export const MONTHLY_BONUS_RATE = 5; // % of directs' previous-month Daily P/L
const BONUS_MIN_CAPITAL = 50;
const round2b = (n: number) => Math.round(n * 100) / 100;

/** 'YYYY-MM' Manila month key for a date. */
function manilaMonthKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(d);
}

/** The previous Manila calendar month as 'YYYY-MM'. */
export function previousManilaMonth(now = new Date()): string {
  const [y, m] = manilaMonthKey(now).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** UTC instant of the 1st of `monthYear` at 00:00 Manila. */
function manilaMonthStartUTC(monthYear: string): Date {
  return new Date(`${monthYear}-01T00:00:00+08:00`);
}
/** UTC instant of the 1st of the following month at 00:00 Manila (exclusive). */
function manilaMonthEndUTC(monthYear: string): Date {
  const d = manilaMonthStartUTC(monthYear);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** Sum of a client's APPROVED deposits dated strictly before `before`. */
async function approvedDepositsBefore(clientId: string | null, before: Date): Promise<number> {
  if (!clientId) return 0;
  const agg = await prisma.transaction.aggregate({
    where: { clientId, type: "DEPOSIT", status: "APPROVED", date: { lt: before } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export interface MonthlyBonusResult {
  month: string;
  paid: number;
  totalPaid: number;
}

/**
 * Pay the monthly direct-referral bonus for `monthYear` (defaults to the
 * previous Manila month). Idempotent per (user, month) via a unique constraint.
 *
 * For each earner who (a) entered the payout month with Active Capital ≥ $50 and
 * (b) has ≥ 1 direct that held ≥ $50 Active Capital for the ENTIRE month:
 *   bonus = 5% × SUM(those directs' Daily P/L during the month), credited to the
 *   earner's withdrawable balance. No cap. Profit only (not capital).
 */
export async function runMonthlyReferralBonus(opts?: { monthYear?: string }): Promise<MonthlyBonusResult> {
  await ensureReferralSchemaOnce(prisma);
  const monthYear = opts?.monthYear ?? previousManilaMonth();
  const monthStart = manilaMonthStartUTC(monthYear);
  const monthEnd = manilaMonthEndUTC(monthYear);

  const earners = await prisma.user.findMany({
    where: { referrals: { some: {} } },
    select: { id: true, clientId: true },
  });

  let paid = 0;
  let totalPaid = 0;

  for (const earner of earners) {
    try {
      // Idempotency — already paid this month?
      const done = await prisma.monthlyBonus.findUnique({
        where: { userId_monthYear: { userId: earner.id, monthYear } },
      });
      if (done) continue;

      // Requirement 1: earner had Active Capital ≥ $50 entering the payout month.
      const earnerCap = await approvedDepositsBefore(earner.clientId, monthEnd);
      if (earnerCap < BONUS_MIN_CAPITAL) continue;

      // Qualifying directs: held ≥ $50 for the ENTIRE month (i.e. funded before
      // month start) AND their client is ACTIVE.
      const directs = await prisma.user.findMany({
        where: { referredById: earner.id },
        select: { clientId: true },
      });
      const dClientIds = directs.map((d) => d.clientId).filter(Boolean) as string[];
      if (dClientIds.length === 0) continue;

      const activeClients = await prisma.client.findMany({
        where: { id: { in: dClientIds }, status: "ACTIVE" },
        select: { id: true },
      });
      const activeSet = new Set(activeClients.map((c) => c.id));

      const qualifying: string[] = [];
      for (const cid of dClientIds) {
        if (!activeSet.has(cid)) continue;
        const capBeforeMonth = await approvedDepositsBefore(cid, monthStart);
        if (capBeforeMonth >= BONUS_MIN_CAPITAL) qualifying.push(cid);
      }
      // Requirement 2: ≥ 1 qualifying active direct.
      if (qualifying.length === 0) continue;

      // Sum those directs' Daily P/L generated during the month.
      const rows = await prisma.dailyPerformance.findMany({
        where: { clientId: { in: qualifying }, date: { gte: monthStart, lt: monthEnd } },
        select: { pnlUsd: true },
      });
      const totalPl = round2b(rows.reduce((s, r) => s + r.pnlUsd, 0));
      if (totalPl <= 0) continue;

      const bonus = round2b((totalPl * MONTHLY_BONUS_RATE) / 100);
      if (bonus <= 0) continue;

      // Earning gate: skip the bonus if the earner is INACTIVE or CAPPED (5x).
      const gate = await canEarn(earner.id, earner.clientId);
      if (!gate.allowed) continue;

      await prisma.$transaction([
        prisma.monthlyBonus.create({
          data: {
            userId: earner.id,
            monthYear,
            totalDirectsPl: totalPl,
            bonusRate: MONTHLY_BONUS_RATE,
            bonusAmount: bonus,
            directsCount: qualifying.length,
          },
        }),
        prisma.user.update({
          where: { id: earner.id },
          data: { commissionBalance: { increment: bonus } },
        }),
      ]);
      paid += 1;
      totalPaid += bonus;
    } catch (e) {
      console.error(`monthly bonus failed for ${earner.id}:`, e);
    }
  }

  return { month: monthYear, paid, totalPaid: round2b(totalPaid) };
}
