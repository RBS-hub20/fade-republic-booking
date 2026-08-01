"use client";

import { useCallback, useState } from "react";
import { Trophy, Medal, Crown, Copy, Check, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatUsd } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/referrals";

const GOAL = 5000;

function rankBadge(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold-300" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-zinc-300" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-sm font-semibold text-muted-foreground">{rank}</span>;
}

export function LeaderboardView({
  top, me, totalRanked, monthLabel, referralCode, origin,
}: {
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  totalRanked: number;
  monthLabel: string;
  referralCode: string | null;
  origin: string;
}) {
  const [copied, setCopied] = useState(false);
  const refLink = referralCode ? `${origin}/signup?ref=${referralCode}` : `${origin}/signup`;
  const copyLink = useCallback(async () => {
    try { await navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }, [refLink]);

  const meInTop = me && me.rank <= top.length;
  const row = (e: LeaderboardEntry, highlight: boolean) => (
    <div
      key={e.userId}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5",
        highlight ? "border border-gold-400/50 bg-gold-400/10" : "odd:bg-muted/30"
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">{rankBadge(e.rank)}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {e.name}
        {highlight && <span className="ml-1.5 rounded bg-gold-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-gold-300">You</span>}
      </span>
      <span className="tabular-nums text-sm font-bold text-gold-300">{formatUsd(e.sales)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Your standing */}
      <Card className="border-gold-400/30 bg-gradient-to-br from-gold-400/10 to-transparent p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your network sales · {monthLabel}</p>
            <p className="mt-1 text-2xl font-extrabold text-gold-300">
              {me ? formatUsd(me.sales) : formatUsd(0)}
              <span className="text-base font-medium text-muted-foreground"> / {formatUsd(GOAL)}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {me ? `Rank #${me.rank} of ${totalRanked}` : "Not ranked yet — invite your first builder!"}
              {" · "}Shanghai goal {formatUsd(GOAL)}
            </p>
          </div>
          <Trophy className="h-10 w-10 shrink-0 text-gold-400/70" />
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300" style={{ width: `${Math.min(100, ((me?.sales ?? 0) / GOAL) * 100)}%` }} />
        </div>
        <Button onClick={copyLink} className="mt-4 w-full bg-gold-400 text-black hover:bg-gold-300">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Link copied!" : "Invite more — copy my link"}
        </Button>
      </Card>

      {/* Top 20 */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold-400" />
          <h2 className="text-sm font-semibold">Top {top.length || 20} Builders · {monthLabel}</h2>
        </div>
        {top.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No network sales recorded yet this month. Be the first! 🚀</p>
          </div>
        ) : (
          <div className="space-y-1">
            {top.map((e) => row(e, !!me && e.userId === me.userId))}
          </div>
        )}
      </Card>

      {/* My rank if outside the top list */}
      {me && !meInTop && (
        <Card className="p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Your rank</p>
          {row(me, true)}
        </Card>
      )}
    </div>
  );
}
