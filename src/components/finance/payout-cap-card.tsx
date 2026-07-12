"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Gauge, Info, RefreshCw, PlusCircle } from "lucide-react";
import { cn, formatUsd } from "@/lib/utils";
import type { PayoutState } from "@/lib/payout-cap";

/**
 * MAX PAYOUT CAP card — 5x of remaining capital, counting ALL earnings.
 * Progress bar: green 0–70%, yellow 70–90%, red 90–100%. Shows "$X remaining"
 * or "CAPPED", and — when capped — the reactivation actions.
 */
export function PayoutCapCard({
  payout,
  clientId,
}: {
  payout: PayoutState;
  clientId: string | null;
}) {
  const { pct, totalEarnedAll, maxPayoutCap, remaining, capped, status } = payout;
  const inactive = status === "INACTIVE";
  const barColor = capped || pct >= 90 ? "bg-loss" : pct >= 70 ? "bg-gold-400" : "bg-profit";

  return (
    <Card className={cn("p-4", capped && "border-loss/40")}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Max Payout Cap
          </p>
          <span
            title="Includes all earnings: Daily ROI + Referrals + Bonuses"
            className="cursor-help text-muted-foreground/70"
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </div>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            capped ? "bg-loss/15 text-loss" : "bg-gold-400/15 text-gold-300"
          )}
        >
          <Gauge className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="tnum text-2xl font-bold text-foreground">
          {formatUsd(totalEarnedAll)}
          <span className="text-base font-medium text-muted-foreground"> / {formatUsd(maxPayoutCap)}</span>
        </p>
        <p className={cn("tnum text-sm font-semibold", capped ? "text-loss" : "text-muted-foreground")}>
          {pct}%
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-[width]", barColor)}
          style={{ width: `${Math.max(pct, capped ? 100 : 2)}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        {capped ? (
          <span className="inline-flex items-center gap-1 rounded bg-loss/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-loss">
            Capped
          </span>
        ) : inactive ? (
          <span className="text-xs text-muted-foreground">Inactive — no active capital</span>
        ) : (
          <span className="tnum text-xs text-muted-foreground">
            {formatUsd(remaining)} remaining
          </span>
        )}
      </div>

      {capped && (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            All earnings stopped. You&apos;ve reached your 5x limit. Add or renew capital to lift the cap.
          </p>
          <div className="mt-2 flex gap-2">
            {clientId && (
              <Link
                href={`/reports/${clientId}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Renew Package
              </Link>
            )}
            <Link
              href="/qx-tiers"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gold-400 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-gold-300"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Buy New Package
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}
