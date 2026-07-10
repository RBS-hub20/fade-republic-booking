/**
 * Referral program core (Node runtime only).
 *
 * Model:
 *  - Every user has a unique `referralCode` (first 4 letters of name + 3 digits).
 *  - New signups may pass `?ref=CODE`, tagging them to a referrer.
 *  - When a referred user activates their FIRST QX Tier (their first approved
 *    tier-sized deposit), the referrer earns a commission based on the
 *    referrer's OWN tier at that moment (5/6/7/8%). Only the first package per
 *    referral ever counts — enforced by the unique `referredUserId`.
 *  - Commissions land as PENDING and auto-settle to PAID after 24h, at which
 *    point they credit the referrer's withdrawable `commissionBalance`.
 */
import { prisma } from "./prisma";
import { getClientPerformance } from "./data";
import { TIERS, tierForBalance, type TierId } from "./tiers";
import { REFERRALS_ENABLED } from "./referrals-config";
import { ensureReferralSchemaOnce } from "./referral-schema";

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
 * Credit the 2nd-level (indirect) commission for a source user's FIRST package.
 * Walks up from the direct referrer's upline to the nearest UNLOCKED upline
 * (compression), and pays them `level2Rate(theirTier) × packageAmount` once.
 */
async function creditLevel2Commission(opts: {
  sourceUserId: string;
  directUplineId: string;
  startUplineId: string | null; // the direct referrer's referrer (grandparent)
  packageAmount: number;
}): Promise<void> {
  if (!opts.startUplineId) return;
  const existing = await prisma.level2Commission.findUnique({
    where: { sourceUserId: opts.sourceUserId },
  });
  if (existing) return; // first deposit only

  // Compression: find the nearest qualified (unlocked) upline in the chain.
  let cursorId: string | null = opts.startUplineId;
  let earner: { id: string; clientId: string | null } | null = null;
  for (let i = 0; i < MAX_UPLINE_WALK && cursorId; i++) {
    const cand: { id: string; clientId: string | null; referredById: string | null } | null =
      await prisma.user.findUnique({
        where: { id: cursorId },
        select: { id: true, clientId: true, referredById: true },
      });
    if (!cand) break;
    const unlock = await prisma.userUnlock.findUnique({ where: { userId: cand.id } }).catch(() => null);
    if (unlock?.level2Unlocked) {
      earner = { id: cand.id, clientId: cand.clientId };
      break;
    }
    cursorId = cand.referredById;
  }
  if (!earner) return; // no qualified upline in the chain

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
 * Credit a referral commission when a client's FIRST tier-sized deposit is
 * approved. Idempotent and safe to call from every approval path.
 */
export async function creditFirstPackageCommission(opts: {
  clientId: string;
  amount: number;
}): Promise<void> {
  if (!REFERRALS_ENABLED) return;
  try {
    await ensureReferralSchemaOnce(prisma);

    // Which package did they activate? Must be at least Bronze ($50).
    const tier = tierForBalance(opts.amount);
    if (!tier) return; // below the lowest tier — not a package activation

    const referred = await prisma.user.findUnique({ where: { clientId: opts.clientId } });
    if (!referred || !referred.referredById) return; // not referred

    // First package only — bail if this referral already generated a commission.
    const existing = await prisma.referralCommission.findUnique({
      where: { referredUserId: referred.id },
    });
    if (existing) return;

    // Referrer's rate is based on THEIR tier at purchase time.
    const referrer = await prisma.user.findUnique({ where: { id: referred.referredById } });
    if (!referrer) return;
    const referrerBalance = await balanceOfUser(referrer.clientId);
    const rate = commissionRateForBalance(referrerBalance);
    const commission = Math.round(tier.price * (rate / 100) * 100) / 100;

    // INSTANT credit (level 1): record the commission as PAID and add it to the
    // referrer's withdrawable balance immediately — no pending, no 24h delay.
    await prisma.$transaction([
      prisma.referralCommission.create({
        data: {
          referrerId: referrer.id,
          referredUserId: referred.id,
          referredName: referred.name,
          packageLabel: `${tier.name} $${tier.price}`,
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

    // Level 2 (indirect): pay the nearest UNLOCKED upline above the referrer.
    await creditLevel2Commission({
      sourceUserId: referred.id,
      directUplineId: referrer.id,
      startUplineId: referrer.referredById,
      packageAmount: tier.price,
    });

    // The referrer just gained a (potentially) qualifying active direct —
    // refresh their unlock so they can start earning level-2 promptly.
    await recomputeUnlock(referrer.id).catch(() => {});
  } catch (e) {
    // Commission crediting must never break a deposit approval.
    console.error("creditFirstPackageCommission failed (ignored):", e);
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

  const [totalReferrals, commissions, fresh, level2Agg, unlock] = await Promise.all([
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
  ]);

  let balance = 0;
  if (user.clientId) {
    const perf = await getClientPerformance(user.clientId).catch(() => null);
    balance = perf?.kpis.currentBalance ?? 0;
  }
  const tier = tierForBalance(balance);

  const paid = commissions.filter((c) => c.status === "PAID");
  const pending = commissions.filter((c) => c.status === "PENDING");
  const level2Earned = Math.round((level2Agg._sum.commissionAmount ?? 0) * 100) / 100;

  return {
    code,
    link: `${APP_ORIGIN}/signup?ref=${code}`,
    totalReferrals,
    activeReferrals: paid.length,
    pendingReferrals: pending.length,
    commissionRate: commissionRateForBalance(balance),
    totalEarned: Math.round((paid.reduce((s, c) => s + c.commission, 0) + level2Earned) * 100) / 100,
    commissionBalance: fresh?.commissionBalance ?? user.commissionBalance ?? 0,
    tierName: tier?.name ?? "None",
    level2Unlocked: unlock?.level2Unlocked ?? false,
    level2Rate: level2RateForBalance(balance),
    activeDirects: unlock?.activeDirectsCount ?? 0,
    directsRequired: DIRECTS_REQUIRED,
    level2Earned,
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

/** Example-calculator amount for the "Silver $100" illustration. */
export function exampleCommission(rate: number): number {
  const silver = TIERS.find((t) => t.id === "silver")!;
  return Math.round(silver.price * (rate / 100) * 100) / 100;
}
