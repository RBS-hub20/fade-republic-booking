"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, Ban, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDateKey } from "@/lib/utils";

export interface TodayStatus {
  todayKey: string;
  eligibleCount: number;
  postedCount: number;
  allPosted: boolean;
  markedNoTrading: boolean;
  markedAt: string | null;
}

/**
 * "Trading Day Control" — a 4th admin option alongside the nightly cron,
 * "Backfill now", and self-heal. One click marks TODAY as a No Trading Day,
 * posting 0.00% for every eligible client. Disabled once today is fully posted.
 */
export function NoTradingDayCard({ status }: { status: TodayStatus }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { eligibleCount, postedCount, allPosted, markedNoTrading, markedAt } = status;

  const todayStatus = allPosted
    ? markedNoTrading
      ? "Marked as No Trading Day (0.00%)"
      : "Posted — active trading day"
    : postedCount > 0
    ? `Partially posted (${postedCount}/${eligibleCount})`
    : "Not posted yet — waiting for 23:59 PHT cron or manual action";

  async function markNoTradingDay() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/no-trading-day", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Failed to mark No Trading Day");
      const created = data?.result?.created ?? 0;
      setMsg(`Done — 0.00% posted for ${created} client${created === 1 ? "" : "s"} today.`);
      setConfirm(false);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarX className="h-5 w-5 text-amber-500" />
          Trading Day Control
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="font-medium">Mark Today as No Trading Day</p>
            <p className="text-sm text-muted-foreground">
              Posts 0.00% P/L for ALL {eligibleCount} active client account
              {eligibleCount === 1 ? "" : "s"} today ({formatDateKey(status.todayKey)}). Use for
              holidays, weekends, maintenance, or zero-volatility days.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Today’s status: {todayStatus}</p>
          </div>

          <Button
            variant="outline"
            disabled={allPosted || busy}
            className="w-full sm:w-auto"
            onClick={() => {
              setMsg(null);
              setConfirm(true);
            }}
          >
            <Ban className="h-4 w-4" />
            {allPosted ? "Today already posted" : "Post 0.00% for All Clients Today"}
          </Button>

          {msg && <p className="text-xs text-gold-300">{msg}</p>}

          {markedNoTrading && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-muted-foreground">
                Today marked as No Trading Day
                {markedAt ? ` at ${new Date(markedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : ""}.
                The 23:59 PHT cron will skip today. Clients see “No trading activity 0.00%”.
              </p>
            </div>
          )}
        </div>
      </CardContent>

      <Modal
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title="Mark as No Trading Day?"
        description="This posts 0.00% entries for ALL active client accounts today."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">This is permanent for today and cannot be undone.</strong>
            <br />
            Clients will see “No trading activity 0.00%” on their dashboard, and the 23:59 PHT cron
            will skip today’s run.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={markNoTradingDay} disabled={busy}>
              {busy ? "Posting…" : "Confirm — Post 0.00%"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
