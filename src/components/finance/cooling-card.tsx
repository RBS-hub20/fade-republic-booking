"use client";

import { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatUsd } from "@/lib/utils";

/**
 * Shows the 24h cooling countdown for freshly-purchased capital that isn't
 * earning daily profit yet. Rendered only when there IS cooling capital.
 */
export function CoolingCard({
  amount,
  nextProfitAt,
}: {
  amount: number;
  nextProfitAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = nextProfitAt ? new Date(nextProfitAt).getTime() : 0;
  const ms = Math.max(0, target - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);

  return (
    <Card className="border-gold-400/30 bg-gold-400/[0.04] p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cooling Period
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold-400/15 text-gold-300">
          <Hourglass className="h-4 w-4" />
        </span>
      </div>

      {ms > 0 ? (
        <p className="tnum mt-3 text-2xl font-bold text-gold-300">
          {h}h {m}m {s}s <span className="text-sm font-medium text-muted-foreground">remaining</span>
        </p>
      ) : (
        <p className="mt-3 text-2xl font-bold text-profit">Starting shortly…</p>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{formatUsd(amount)}</span> in cooling — starts
        earning daily profit after 24 hours.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        New packages start earning after 24 hours to allow for trade allocation. Renewals earn
        immediately.
      </p>
    </Card>
  );
}
