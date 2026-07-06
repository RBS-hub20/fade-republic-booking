/**
 * QX Tiers — the four QuantumX Global Markets funding packages.
 *
 * A client's *current tier* is derived from their account balance: the highest
 * package whose price they've funded up to. Below the Bronze price the client
 * has no tier yet (and is nudged to the /qx-tiers page after login).
 *
 * Package artwork lives in /public/tiers (mapped 1:1 to each tier's `image`).
 */

export type TierId = "bronze" | "silver" | "gold" | "platinum";

export interface Tier {
  id: TierId;
  name: string;
  /** Funding amount in USD, pre-filled on the deposit screen. */
  price: number;
  /** Public path to the package artwork. */
  image: string;
  /** Single-letter monogram used for the compact header badge. */
  monogram: string;
  /** Tailwind accent classes for the tier's metal colour. */
  accent: string;
  ring: string;
}

export const TIERS: Tier[] = [
  { id: "bronze",   name: "Bronze",   price: 50,  image: "/tiers/bronze.png",   monogram: "B", accent: "text-amber-500",  ring: "ring-amber-600/50" },
  { id: "silver",   name: "Silver",   price: 100, image: "/tiers/silver.png",   monogram: "S", accent: "text-zinc-300",   ring: "ring-zinc-400/50" },
  { id: "gold",     name: "Gold",     price: 250, image: "/tiers/gold.png",     monogram: "G", accent: "text-gold-400",   ring: "ring-gold-400/50" },
  { id: "platinum", name: "Platinum", price: 500, image: "/tiers/platinum.png", monogram: "P", accent: "text-slate-200",  ring: "ring-slate-300/50" },
];

/** Highest tier the given balance qualifies for, or null when below Bronze. */
export function tierForBalance(balance: number): Tier | null {
  let current: Tier | null = null;
  for (const t of TIERS) {
    if (balance >= t.price) current = t;
  }
  return current;
}
