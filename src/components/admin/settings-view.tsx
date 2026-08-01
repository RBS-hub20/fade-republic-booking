"use client";

import { useState } from "react";
import Link from "next/link";
import { PartyPopper, Plane, Eye, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FLAG_BONUS_MODAL = "celebration.bonusModal";
const FLAG_SHANGHAI_MODAL = "celebration.shanghaiModal";

function Toggle({ on, busy, onClick }: { on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        on ? "bg-profit" : "bg-muted"
      )}
    >
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
      {busy && <Loader2 className="absolute -right-6 h-4 w-4 animate-spin text-muted-foreground" />}
    </button>
  );
}

export function SettingsView({ initial }: { initial: Record<string, boolean> }) {
  const [flags, setFlags] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(key: string) {
    setBusy(key);
    setErr(null);
    const next = !flags[key];
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.flags) setFlags(data.flags);
      else setErr(data.error ?? "Could not save");
    } catch {
      setErr("Could not save");
    }
    setBusy(null);
  }

  const row = (
    key: string,
    icon: React.ReactNode,
    title: string,
    desc: string,
    previewHref: string,
    previewLabel: string,
  ) => (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/10 text-gold-300">{icon}</span>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{title}</p>
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", flags[key] ? "bg-profit/15 text-profit" : "bg-muted text-muted-foreground")}>
              {flags[key] ? "ON" : "OFF"}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:pl-3">
        <Button asChild variant="outline" size="sm">
          <Link href={previewHref} target="_blank"><Eye className="h-4 w-4" /> {previewLabel}</Link>
        </Button>
        <Toggle on={flags[key]} busy={busy === key} onClick={() => toggle(key)} />
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {err && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{err}</p>}
      {row(
        FLAG_BONUS_MODAL,
        <PartyPopper className="h-4 w-4" />,
        "Monthly Bonus celebration",
        "The BOOM! login pop-up (1st–3rd of the month) for clients with a monthly bonus.",
        "/dashboard?celebrate=preview",
        "Test Bonus",
      )}
      {row(
        FLAG_SHANGHAI_MODAL,
        <Plane className="h-4 w-4" />,
        "Shanghai promo pop-up",
        "The Aug 4–31 travel-incentive pop-up (once per day) with the $5,000 progress bar.",
        "/dashboard?shanghai=preview",
        "Test Shanghai",
      )}
      <p className="text-xs text-muted-foreground">
        Toggling OFF stops the pop-up from appearing for clients. The Test buttons force it for you (preview) regardless of the toggle or the date window.
      </p>
    </div>
  );
}
