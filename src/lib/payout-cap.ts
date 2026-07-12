/**
 * 5x Max Payout Cap (Node runtime only).
 *
 * Rule: Max Payout = remaining locked principal × 5. EVERY earning type counts
 * toward the cap — daily ROI/P&L, direct (L1) + indirect (L2) referral
 * commissions, and monthly bonuses (renewal/"upgrade" commissions are just
 * referral commissions, already included). Original principal deposits are
 * EXCLUDED. Once total earned reaches the cap, all earnings STOP until the user
 * adds or renews capital (which raises the cap).
 *
 * The authoritative numbers are DERIVED from the same records the rest of the
 * app already trusts (no drift): remaining principal from the capital model,
 * and lifetime earnings from DailyPerformance + the commission tables. The
 * UserPayoutTracking table is a synced cache for admin visibility and matches
 * the requested schema; it is never the source of truth.
 */
import { prisma } from "./prisma";
import { getRemainingPrincipal } from "./capital";

export const PAYOUT_MULTIPLIER = 5;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type PayoutStatus = "ACTIVE" | "CAPPED" | "INACTIVE";

export interface PayoutState {
  /** Remaining locked principal (active + matured, net of withdrawals). */
  activeCapital: number;
  /** activeCapital × 5. */
  maxPayoutCap: number;
  /** Lifetime earnings across all types (daily ROI + L1 + L2 + monthly bonus). */
  totalEarnedAll: number;
  /** max(0, cap − earned). */
  remaining: number;
  /** 0–100, earned / cap. */
  pct: number;
  status: PayoutStatus;
  /** true when earnings must stop (earned ≥ cap, cap > 0). */
  capped: boolean;
}

// --- Self-heal DDL (mirrors the referral/finance schema guards) -------------
export const PAYOUT_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "UserPayoutTracking" (
     "userId" TEXT NOT NULL PRIMARY KEY,
     "totalActiveCapital" DOUBLE PRECISION NOT NULL DEFAULT 0,
     "maxPayoutCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
     "totalEarnedAll" DOUBLE PRECISION NOT NULL DEFAULT 0,
     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
];

let schemaHealed = false;
export async function ensurePayoutSchemaOnce(): Promise<void> {
  if (schemaHealed) return;
  try {
    for (const sql of PAYOUT_DDL) await prisma.$executeRawUnsafe(sql);
    schemaHealed = true;
  } catch (e) {
    console.error("[payout-schema] self-heal failed:", e);
  }
}

/** Lifetime earnings that count toward the cap (all income, not principal). */
async function computeEarned(userId: string, clientId: string | null): Promise<number> {
  const [pnl, l1, l2, monthly] = await Promise.all([
    clientId
      ? prisma.dailyPerformance
          .aggregate({ where: { clientId }, _sum: { pnlUsd: true } })
          .catch(() => ({ _sum: { pnlUsd: 0 } }))
      : Promise.resolve({ _sum: { pnlUsd: 0 } }),
    prisma.referralCommission
      .aggregate({ where: { referrerId: userId, status: "PAID" }, _sum: { commission: true } })
      .catch(() => ({ _sum: { commission: 0 } })),
    prisma.level2Commission
      .aggregate({ where: { earnerId: userId }, _sum: { commissionAmount: true } })
      .catch(() => ({ _sum: { commissionAmount: 0 } })),
    prisma.monthlyBonus
      .aggregate({ where: { userId }, _sum: { bonusAmount: true } })
      .catch(() => ({ _sum: { bonusAmount: 0 } })),
  ]);
  return round2(
    (pnl._sum.pnlUsd ?? 0) +
      (l1._sum.commission ?? 0) +
      (l2._sum.commissionAmount ?? 0) +
      (monthly._sum.bonusAmount ?? 0)
  );
}

/** Derive the live payout state for a user (does not touch the cache table). */
export async function getPayoutState(userId: string, clientId: string | null): Promise<PayoutState> {
  const [activeCapital, totalEarnedAll] = await Promise.all([
    getRemainingPrincipal(clientId),
    computeEarned(userId, clientId),
  ]);
  const maxPayoutCap = round2(activeCapital * PAYOUT_MULTIPLIER);
  const remaining = round2(Math.max(0, maxPayoutCap - totalEarnedAll));
  const status: PayoutStatus =
    activeCapital <= 0 ? "INACTIVE" : maxPayoutCap > 0 && totalEarnedAll >= maxPayoutCap ? "CAPPED" : "ACTIVE";
  const pct = maxPayoutCap > 0 ? Math.min(100, Math.round((totalEarnedAll / maxPayoutCap) * 100)) : 0;
  return { activeCapital, maxPayoutCap, totalEarnedAll, remaining, pct, status, capped: status === "CAPPED" };
}

/** Best-effort sync of the UserPayoutTracking cache row (never throws). */
export async function syncPayoutTracking(userId: string, state: PayoutState): Promise<void> {
  await ensurePayoutSchemaOnce();
  await prisma.userPayoutTracking
    .upsert({
      where: { userId },
      update: {
        totalActiveCapital: state.activeCapital,
        maxPayoutCap: state.maxPayoutCap,
        totalEarnedAll: state.totalEarnedAll,
        status: state.status,
      },
      create: {
        userId,
        totalActiveCapital: state.activeCapital,
        maxPayoutCap: state.maxPayoutCap,
        totalEarnedAll: state.totalEarnedAll,
        status: state.status,
      },
    })
    .catch(() => {});
}

/**
 * Earning gate — the single check to run BEFORE crediting any earning to a
 * user. Allowed only when the account is ACTIVE (has capital AND is under the
 * 5x cap). Also refreshes the cache row. Never throws — on any error it FAILS
 * OPEN (allowed) so a tracking hiccup can't silently starve real earnings.
 */
export async function canEarn(
  userId: string,
  clientId: string | null
): Promise<{ allowed: boolean; state: PayoutState | null }> {
  try {
    const state = await getPayoutState(userId, clientId);
    void syncPayoutTracking(userId, state);
    return { allowed: state.status === "ACTIVE", state };
  } catch (e) {
    console.error("[payout-cap] canEarn failed (allowing):", e);
    return { allowed: true, state: null };
  }
}

/** Recompute + persist a user's tracking (e.g. after a purchase/renewal). */
export async function refreshPayoutTracking(userId: string, clientId: string | null): Promise<PayoutState | null> {
  try {
    const state = await getPayoutState(userId, clientId);
    await syncPayoutTracking(userId, state);
    return state;
  } catch (e) {
    console.error("[payout-cap] refresh failed:", e);
    return null;
  }
}

/**
 * Refresh tracking for the user who owns a client account — used on
 * purchase/renewal, where only the clientId is on hand. Adding/renewing capital
 * raises the cap, so a previously CAPPED account flips back to ACTIVE here.
 */
export async function refreshPayoutTrackingByClient(clientId: string | null): Promise<void> {
  if (!clientId) return;
  const user = await prisma.user
    .findUnique({ where: { clientId }, select: { id: true } })
    .catch(() => null);
  if (user) await refreshPayoutTracking(user.id, clientId);
}
