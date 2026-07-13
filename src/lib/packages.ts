/**
 * Active-package (locked-capital) view helpers — pure & client-safe (no
 * prisma, no Node APIs), so the statement page (server) and the ReportView
 * (client) can share the same tier/progress mapping.
 *
 * A "package" is an approved capital deposit under its 6-month lock. The tier
 * is derived from the funded amount (Bronze $50 / Silver $100 / Gold $250 /
 * Platinum $500). The unlock date and days-left come straight from the capital
 * money-model (see src/lib/capital.ts), so they always match the wallet page.
 */
import { TIERS, type Tier } from "./tiers";

/** Progress-bar denominator: the nominal 6-month lock expressed in days. */
export const LOCK_DAYS = 180;

export interface PackageRow {
  id: string;
  tierId: Tier["id"] | null;
  /** Upper-cased tier name, e.g. "PLATINUM" (or "PACKAGE" when off-tier). */
  label: string;
  emoji: string;
  amount: number;
  /** ISO strings. */
  purchaseDate: string;
  unlockDate: string;
  /** Projected unlock date if renewed now (current unlock + 6 months). */
  renewUnlockDate: string;
  locked: boolean;
  daysLeft: number;
  /** 0–100, clamped. */
  progressPct: number;
  /** In its 24h cooling window — not earning daily profit yet. */
  cooling: boolean;
}

const EMOJI: Record<Tier["id"], string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

/** Emoji for a tier id (generic box when the amount is below Bronze). */
export function packageEmoji(tierId: Tier["id"] | null): string {
  return tierId ? EMOJI[tierId] : "📦";
}

/**
 * The package tier a funded amount buys: an exact price match wins, otherwise
 * the highest tier the amount covers (e.g. $300 → Gold). Below Bronze → null.
 */
export function tierForPackageAmount(amount: number): Tier | null {
  const exact = TIERS.find((t) => t.price === amount);
  if (exact) return exact;
  let current: Tier | null = null;
  for (const t of TIERS) if (amount >= t.price) current = t;
  return current;
}

/** Lock progress as a clamped 0–100 %: (180 − daysLeft) / 180. */
export function packageProgress(daysLeft: number): number {
  const pct = ((LOCK_DAYS - daysLeft) / LOCK_DAYS) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
