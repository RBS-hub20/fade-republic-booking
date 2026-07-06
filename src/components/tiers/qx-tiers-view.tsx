"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatUsd } from "@/lib/utils";
import { TIERS, type TierId } from "@/lib/tiers";

/**
 * The QX Tiers storefront: a 2×2 grid (single column on mobile) of the four
 * funding packages. Each card uses its supplied artwork and a gold
 * "Select Package" action that jumps to the deposit flow with the amount
 * pre-filled.
 */
export function QxTiersView({ currentTier }: { currentTier: TierId | null }) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {TIERS.map((tier) => {
        const active = currentTier === tier.id;
        return (
          <div
            key={tier.id}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300",
              "hover:scale-[1.02] hover:border-gold-400/60 hover:shadow-[0_0_28px_-4px_rgba(224,181,74,0.45)]",
              active && "border-gold-400/70 shadow-[0_0_24px_-6px_rgba(224,181,74,0.5)]"
            )}
          >
            {active && (
              <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-gold-400 px-2.5 py-1 text-[11px] font-bold text-black shadow">
                <Check className="h-3 w-3" /> Current Tier
              </span>
            )}

            {/* Package artwork (square) */}
            <div className="relative aspect-square w-full bg-black">
              <Image
                src={tier.image}
                alt={`QuantumX ${tier.name} Package — ${formatUsd(tier.price)}`}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                priority={tier.id === "bronze" || tier.id === "silver"}
              />
            </div>

            {/* Details + action */}
            <div className="flex items-center justify-between gap-3 border-t border-border p-4">
              <div>
                <p className="text-base font-bold tracking-tight">
                  {tier.name} <span className={cn("font-semibold", tier.accent)}>Package</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Fund with <span className="font-semibold text-gold-300">{formatUsd(tier.price)}</span> USD
                </p>
              </div>
              <Button
                onClick={() => router.push(`/deposit?amount=${tier.price}`)}
                className="shrink-0 bg-gradient-to-r from-gold-300 to-gold-500 font-semibold text-black hover:from-gold-200 hover:to-gold-400"
              >
                Select Package
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
