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
const SETTLE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h pending → paid

/** Commission % for a given balance-derived tier (None/Bronze both 5%). */
export function commissionRateForBalance(balance: number): number {
  const tier = tierForBalance(balance);
  return COMMISSION_RATES[tier?.id ?? "none"];
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
    let referrerBalance = 0;
    if (referrer.clientId) {
      const perf = await getClientPerformance(referrer.clientId).catch(() => null);
      referrerBalance = perf?.kpis.currentBalance ?? 0;
    }
    const rate = commissionRateForBalance(referrerBalance);
    const commission = Math.round(tier.price * (rate / 100) * 100) / 100;

    await prisma.referralCommission.create({
      data: {
        referrerId: referrer.id,
        referredUserId: referred.id,
        referredName: referred.name,
        packageLabel: `${tier.name} $${tier.price}`,
        packageAmount: tier.price,
        commission,
        status: "PENDING",
      },
    });
  } catch (e) {
    // Commission crediting must never break a deposit approval.
    console.error("creditFirstPackageCommission failed (ignored):", e);
  }
}

/**
 * Settle any of a referrer's PENDING commissions older than 24h → PAID, crediting
 * their withdrawable commissionBalance. Lazy: called on dashboard load.
 */
export async function settleDueCommissions(referrerId: string): Promise<void> {
  const cutoff = new Date(Date.now() - SETTLE_AFTER_MS);
  const due = await prisma.referralCommission.findMany({
    where: { referrerId, status: "PENDING", createdAt: { lte: cutoff } },
  });
  if (due.length === 0) return;
  const total = due.reduce((s, c) => s + c.commission, 0);
  await prisma.$transaction([
    prisma.referralCommission.updateMany({
      where: { id: { in: due.map((d) => d.id) } },
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
  await settleDueCommissions(user.id).catch(() => {});

  const [totalReferrals, commissions, fresh] = await Promise.all([
    prisma.user.count({ where: { referredById: user.id } }).catch(() => 0),
    prisma.referralCommission
      .findMany({ where: { referrerId: user.id }, orderBy: { createdAt: "desc" } })
      .catch(() => [] as Awaited<ReturnType<typeof prisma.referralCommission.findMany>>),
    prisma.user
      .findUnique({ where: { id: user.id }, select: { commissionBalance: true } })
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

  return {
    code,
    link: `${APP_ORIGIN}/signup?ref=${code}`,
    totalReferrals,
    activeReferrals: paid.length,
    pendingReferrals: pending.length,
    commissionRate: commissionRateForBalance(balance),
    totalEarned: paid.reduce((s, c) => s + c.commission, 0),
    commissionBalance: fresh?.commissionBalance ?? user.commissionBalance ?? 0,
    tierName: tier?.name ?? "None",
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
