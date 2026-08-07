/**
 * Exclusive Network — admin activation of NETWORK_ONLY members.
 *
 * A NETWORK_ONLY user:
 *   - earns 0% daily ROI (gated in daily-performance.ts),
 *   - generates NO upline income from their own activation — direct, indirect,
 *     unlock credit are all skipped (gated in referrals.ts) → company save,
 *   - but keeps ALL of their OWN network earnings (direct / indirect / monthly
 *     bonus / 2nd-level unlock) when they later invite others,
 *   - is still placed in the genealogy (referredById is set at signup).
 *
 * This module is the admin control surface: search candidates, read stats, and
 * apply/clear the activation (recording the estimated company save).
 */
import { prisma } from "./prisma";
import { ensureReferralSchemaOnce } from "./referral-schema";
import { getClientPerformance } from "./data";
import { TIERS, tierById, tierForBalance, type TierId } from "./tiers";
import { COMMISSION_RATES } from "./referrals";

export type ActivationType = "STANDARD" | "NETWORK_ONLY";

export interface ExclusiveRow {
  userId: string;
  email: string;
  username: string | null;
  name: string;
  uplineName: string | null;
  package: string | null;
  activationType: ActivationType;
  note: string | null;
  saved: number;
  funded: boolean;
  activatedAt: string | null;
}

export interface ExclusiveStats {
  totalExclusive: number;
  companySaved: number;
  pending: number;
}

/** Package options for the activation modal (tier id + display label). */
export const EXCLUSIVE_PACKAGES = TIERS.map((t) => ({
  id: t.id,
  label: `${t.name} $${t.price}`,
  price: t.price,
}));

function labelForTier(id: TierId): string {
  const t = tierById(id);
  return t ? `${t.name} $${t.price}` : id;
}

/** Which of these client ids have at least one APPROVED deposit (funded)? */
async function fundedClientIds(clientIds: string[]): Promise<Set<string>> {
  if (clientIds.length === 0) return new Set();
  const rows = await prisma.transaction
    .groupBy({
      by: ["clientId"],
      where: { clientId: { in: clientIds }, type: "DEPOSIT", status: "APPROVED" },
      _sum: { amount: true },
    })
    .catch(() => [] as { clientId: string; _sum: { amount: number | null } }[]);
  return new Set(rows.filter((r) => (r._sum.amount ?? 0) > 0).map((r) => r.clientId));
}

/**
 * Search members by email or username (case-insensitive). With no query, returns
 * the current exclusive (NETWORK_ONLY) members so the admin sees the roster.
 */
export async function searchExclusiveUsers(query?: string, limit = 50): Promise<ExclusiveRow[]> {
  await ensureReferralSchemaOnce(prisma).catch(() => {});
  const q = (query ?? "").trim();

  const where = q
    ? {
        role: "client",
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { role: "client", activationType: "NETWORK_ONLY" };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      clientId: true,
      activationType: true,
      exclusivePackage: true,
      exclusiveNote: true,
      exclusiveSaved: true,
      exclusiveActivatedAt: true,
      referredBy: { select: { name: true, username: true } },
    },
  });

  const funded = await fundedClientIds(users.map((u) => u.clientId).filter(Boolean) as string[]);

  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    username: u.username ?? null,
    name: u.name,
    uplineName: u.referredBy?.username ?? u.referredBy?.name ?? null,
    package: u.exclusivePackage ?? null,
    activationType: (u.activationType as ActivationType) ?? "STANDARD",
    note: u.exclusiveNote ?? null,
    saved: u.exclusiveSaved ?? 0,
    funded: u.clientId ? funded.has(u.clientId) : false,
    activatedAt: u.exclusiveActivatedAt ? u.exclusiveActivatedAt.toISOString() : null,
  }));
}

/** Dashboard stats card figures. */
export async function getExclusiveStats(): Promise<ExclusiveStats> {
  await ensureReferralSchemaOnce(prisma).catch(() => {});
  const [totalExclusive, savedAgg, exclusiveUsers] = await Promise.all([
    prisma.user.count({ where: { activationType: "NETWORK_ONLY" } }).catch(() => 0),
    prisma.user
      .aggregate({ where: { activationType: "NETWORK_ONLY" }, _sum: { exclusiveSaved: true } })
      .catch(() => ({ _sum: { exclusiveSaved: 0 } })),
    prisma.user
      .findMany({ where: { activationType: "NETWORK_ONLY" }, select: { clientId: true } })
      .catch(() => [] as { clientId: string | null }[]),
  ]);

  const funded = await fundedClientIds(exclusiveUsers.map((u) => u.clientId).filter(Boolean) as string[]);
  // "Pending" = exclusive members not yet funded (activated but no deposit).
  const pending = exclusiveUsers.filter((u) => !u.clientId || !funded.has(u.clientId)).length;

  return {
    totalExclusive,
    companySaved: Math.round((savedAgg._sum.exclusiveSaved ?? 0) * 100) / 100,
    pending,
  };
}

/**
 * Estimate the upline direct commission the company saves by making this user
 * NETWORK_ONLY: the sponsor's direct rate (by their current tier) × package price.
 * This is the primary, defensible "company save" figure (L1); indirect is small
 * and omitted for a clean, explainable number.
 */
async function estimateCompanySaved(userId: string, price: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true },
  });
  if (!user?.referredById) return 0;
  const sponsor = await prisma.user.findUnique({
    where: { id: user.referredById },
    select: { clientId: true },
  });
  if (!sponsor) return 0;
  const balance = sponsor.clientId
    ? (await getClientPerformance(sponsor.clientId).catch(() => null))?.kpis.currentBalance ?? 0
    : 0;
  const tier = tierForBalance(balance);
  const rate = COMMISSION_RATES[tier?.id ?? "none"];
  return Math.round(price * (rate / 100) * 100) / 100;
}

/**
 * Apply (or clear) an exclusive activation for a user. NETWORK_ONLY requires a
 * package and a note; STANDARD clears the exclusive fields.
 */
export async function setExclusiveActivation(opts: {
  userId: string;
  activationType: ActivationType;
  packageTierId?: TierId;
  note?: string;
}): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  await ensureReferralSchemaOnce(prisma).catch(() => {});

  const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { id: true } });
  if (!user) return { ok: false, error: "User not found" };

  if (opts.activationType === "STANDARD") {
    await prisma.user.update({
      where: { id: opts.userId },
      data: {
        activationType: "STANDARD",
        exclusivePackage: null,
        exclusiveNote: null,
        exclusiveSaved: 0,
        exclusiveActivatedAt: null,
      },
    });
    return { ok: true, saved: 0 };
  }

  // NETWORK_ONLY
  if (!opts.packageTierId || !tierById(opts.packageTierId)) {
    return { ok: false, error: "A package is required for NETWORK_ONLY activation" };
  }
  const note = (opts.note ?? "").trim();
  if (!note) return { ok: false, error: "A note is required for NETWORK_ONLY activation" };

  const tier = tierById(opts.packageTierId)!;
  const saved = await estimateCompanySaved(opts.userId, tier.price);

  await prisma.user.update({
    where: { id: opts.userId },
    data: {
      activationType: "NETWORK_ONLY",
      exclusivePackage: labelForTier(opts.packageTierId),
      exclusiveNote: note,
      exclusiveSaved: saved,
      exclusiveActivatedAt: new Date(),
    },
  });
  return { ok: true, saved };
}
