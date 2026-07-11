"use client";

import { useState } from "react";
import { Search, Download, RefreshCw, CornerDownRight, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatUsd } from "@/lib/utils";

interface Node {
  level: number;
  userId: string;
  name: string;
  email: string;
  account: string;
  tier: string;
  activeCapital: number;
  isTarget: boolean;
}
interface DownlineMember extends Node {
  relativeLevel: number;
}
interface Downlines {
  userId: string;
  totalTeam: number;
  levels: number;
  totalVolume: number;
  byLevel: { level: number; count: number; volume: number }[];
  members: DownlineMember[];
}

const TIER_COLOR: Record<string, string> = {
  Platinum: "text-slate-200",
  Gold: "text-gold-300",
  Silver: "text-slate-400",
  Bronze: "text-amber-600",
  None: "text-muted-foreground",
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={cn("rounded border border-border px-1.5 py-0.5 text-xs font-medium", TIER_COLOR[tier] ?? "text-muted-foreground")}>
      {tier}
    </span>
  );
}

export function GenealogyExplorer() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upline, setUpline] = useState<Node[] | null>(null);
  const [downlines, setDownlines] = useState<Downlines | null>(null);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setUpline(null);
    setDownlines(null);
    try {
      const [lineRes, downRes] = await Promise.all([
        fetch(`/api/admin/lineage?query=${encodeURIComponent(q)}`),
        fetch(`/api/admin/downlines?query=${encodeURIComponent(q)}`),
      ]);
      if (!lineRes.ok) {
        const d = await lineRes.json().catch(() => ({}));
        throw new Error(d?.error || "User not found.");
      }
      const line = await lineRes.json();
      const down = downRes.ok ? await downRes.json() : null;
      setUpline(line.upline ?? []);
      setDownlines(down);
    } catch (err: any) {
      setError(err?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch("/api/admin/genealogy/backfill", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Backfill failed");
      setBackfillMsg(`Backfill complete — ${d.updated}/${d.scanned} users updated, max depth ${d.maxDepth}${d.cycles ? `, ${d.cycles} cycle(s) skipped` : ""}.`);
    } catch (err: any) {
      setBackfillMsg(err?.message || "Backfill failed.");
    } finally {
      setBackfilling(false);
    }
  }

  function exportCsv() {
    if (!downlines || downlines.members.length === 0) return;
    const header = ["Level", "Name", "Email", "Account", "Tier", "ActiveCapital", "UserId"];
    const rows = downlines.members.map((m) => [
      m.relativeLevel,
      m.name,
      m.email,
      m.account,
      m.tier,
      m.activeCapital.toFixed(2),
      m.userId,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `downline-${downlines.userId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Search + maintenance */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={search} className="flex w-full max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter User ID or email…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-gold-400/60"
            />
          </div>
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? "Searching…" : "Trace"}
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runBackfill} disabled={backfilling}>
            <RefreshCw className={cn("h-4 w-4", backfilling && "animate-spin")} />
            {backfilling ? "Backfilling…" : "Backfill lineage"}
          </Button>
        </div>
      </div>
      {backfillMsg && <p className="text-xs text-gold-300">{backfillMsg}</p>}
      {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

      {/* Upline chain */}
      {upline && (
        <Card>
          <CardHeader>
            <CardTitle>Upline chain — root → member</CardTitle>
          </CardHeader>
          <CardContent>
            {upline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lineage found.</p>
            ) : (
              <div className="space-y-1">
                {upline.map((n) => (
                  <div
                    key={n.userId}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                      n.isTarget ? "bg-gold-400/10 ring-1 ring-gold-400/40" : "hover:bg-secondary/50"
                    )}
                    style={{ marginLeft: n.level * 22 }}
                  >
                    {n.level === 0 ? (
                      <UserIcon className="h-4 w-4 shrink-0 text-gold-300" />
                    ) : (
                      <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">Level {n.level}</span>
                    <span className="font-medium">{n.name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{n.email}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="tnum text-xs text-muted-foreground">{formatUsd(n.activeCapital)}</span>
                      <TierBadge tier={n.tier} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team stats + per-level */}
      {downlines && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Stat label="Total team size" value={String(downlines.totalTeam)} />
              <Stat label="Levels deep" value={String(downlines.levels)} />
              <Stat label="Total team volume" value={formatUsd(downlines.totalVolume)} gold />
              <Button variant="outline" size="sm" className="w-full" onClick={exportCsv} disabled={downlines.members.length === 0}>
                <Download className="h-4 w-4" /> Export downline CSV
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Volume per level</CardTitle>
            </CardHeader>
            <CardContent>
              {downlines.byLevel.length === 0 ? (
                <p className="text-sm text-muted-foreground">No downlines yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-right">Members</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downlines.byLevel.map((l) => (
                      <TableRow key={l.level}>
                        <TableCell className="font-medium">Level {l.level}</TableCell>
                        <TableCell className="tnum text-right">{l.count}</TableCell>
                        <TableCell className="tnum text-right text-gold-300">{formatUsd(l.volume)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Downline members */}
      {downlines && downlines.members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Downline members <span className="text-sm font-normal text-muted-foreground">· {downlines.members.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Active Capital</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downlines.members.map((m) => (
                    <TableRow key={m.userId}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">Level {m.relativeLevel}</TableCell>
                      <TableCell className="font-medium" style={{ paddingLeft: 12 + m.relativeLevel * 14 }}>
                        {m.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.email}</TableCell>
                      <TableCell>
                        <TierBadge tier={m.tier} />
                      </TableCell>
                      <TableCell className="tnum text-right">{formatUsd(m.activeCapital)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("tnum text-lg font-bold", gold ? "text-gold-300" : "text-foreground")}>{value}</span>
    </div>
  );
}
