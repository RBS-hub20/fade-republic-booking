"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDateKey } from "@/lib/utils";

export interface PerfHealth {
  ok: boolean;
  lastPostedKey: string | null;
  yesterdayKey: string;
  stale: boolean;
  daysBehind: number;
  clientsBehind: number;
}

/**
 * "Last P/L posted" status banner for the admin Fund Performance page, with a
 * one-click backfill that runs the same engine as the nightly cron.
 */
export function PerfHealthBanner({ health }: { health: PerfHealth }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const stale = health.stale;
  const last = health.lastPostedKey ? formatDateKey(health.lastPostedKey) : "never";

  async function backfill() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/backfill-pl", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Backfill failed");
      const added = data?.performance?.daysCreated ?? 0;
      setMsg(`Backfill complete — ${added} day-entr${added === 1 ? "y" : "ies"} created.`);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Backfill failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
        stale
          ? "border-loss/40 bg-loss/10"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-3">
        {stale ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-loss" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-profit" />
        )}
        <div>
          <p className="text-sm font-semibold">
            Last P/L posted: <span className="tnum">{last}</span>
            {stale && (
              <span className="ml-2 rounded bg-loss/20 px-1.5 py-0.5 text-xs font-bold uppercase text-loss">
                Alert
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stale
              ? `${health.clientsBehind} client${health.clientsBehind === 1 ? "" : "s"} missing an entry through ${formatDateKey(
                  health.yesterdayKey
                )} (${health.daysBehind} day${health.daysBehind === 1 ? "" : "s"} behind). Runs nightly at 23:59 PHT.`
              : `Up to date through ${formatDateKey(health.yesterdayKey)}. Runs nightly at 23:59 PHT.`}
          </p>
          {msg && <p className="mt-1 text-xs text-gold-300">{msg}</p>}
        </div>
      </div>
      <Button size="sm" variant={stale ? "default" : "outline"} onClick={backfill} disabled={busy}>
        <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
        {busy ? "Backfilling…" : "Backfill now"}
      </Button>
    </div>
  );
}
