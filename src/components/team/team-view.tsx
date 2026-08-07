"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Users, CheckCircle2, Clock, TrendingUp, Copy, Check, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsd, cn } from "@/lib/utils";
import type { TeamMember, TeamPage } from "@/lib/team";

type Filter = "all" | "bought" | "pending";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}
function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
}

function StatusBadge({ m }: { m: TeamMember }) {
  if (m.bought) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Pending
    </span>
  );
}

export function TeamView({ initial, origin }: { initial: TeamPage; origin: string }) {
  const [data, setData] = useState<TeamPage>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const firstRender = useRef(true);

  const refLink = data.referralCode ? `${origin}/signup?ref=${data.referralCode}` : origin;

  const load = useCallback(async (f: Filter, q: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/my-team?filter=${f}&q=${encodeURIComponent(q)}&page=${p}`);
      const json = await res.json().catch(() => ({}));
      if (json.ok) setData(json as TeamPage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced reload whenever filter / search / page changes (skip first mount).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => load(filter, query, page), 250);
    return () => clearTimeout(t);
  }, [filter, query, page, load]);

  function changeFilter(f: Filter) {
    setPage(1);
    setFilter(f);
  }

  async function remind(m: TeamMember) {
    const handle = m.username ? `@${m.username}` : m.displayName;
    const msg = `Hi ${handle}! Bro bili ka na package para mag start daily mo 🚀 Sign up / activate here: ${refLink}`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(m.userId);
      setTimeout(() => setCopiedId((id) => (id === m.userId ? null : id)), 1800);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const { stats } = data;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5 text-gold-400" />} label="Total Team" value={String(stats.total)} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} label="Bought" value={String(stats.bought)} />
        <StatCard icon={<Clock className="h-5 w-5 text-amber-400" />} label="Pending" value={String(stats.pending)} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-gold-400" />} label="Conversion" value={`${stats.conversionRate}%`} />
      </div>

      {/* Invite link */}
      <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Your invite link</p>
          <p className="truncate text-sm font-medium text-gold-300">{refLink}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            navigator.clipboard?.writeText(refLink).then(() => {
              setCopiedId("__link__");
              setTimeout(() => setCopiedId((id) => (id === "__link__" ? null : id)), 1800);
            });
          }}
        >
          {copiedId === "__link__" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-1">Copy link</span>
        </Button>
      </Card>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {(["all", "bought", "pending"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => changeFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? "border-gold-400/60 bg-gold-400/15 text-gold-200"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? "All" : f === "bought" ? "Bought" : "Not Yet Bought"}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            placeholder="Search username…"
            className="pl-9"
          />
        </div>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      )}

      {/* Desktop table */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Signup</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Date Bought</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No team members yet. Share your invite link to grow your team!
                  </TableCell>
                </TableRow>
              ) : (
                data.members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.avatar} alt="" width={32} height={32} className="h-8 w-8 rounded-full bg-secondary" />
                        <div className="leading-tight">
                          <p className="text-sm font-medium">{m.displayName}</p>
                          <p className="text-xs text-muted-foreground">{m.username ? `@${m.username}` : "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(m.signupDate)}</TableCell>
                    <TableCell><StatusBadge m={m} /></TableCell>
                    <TableCell className="text-sm">
                      {m.package ?? <span className="text-muted-foreground">—</span>}
                      {m.isExclusive && <span className="ml-1 text-xs text-gold-400">★</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDay(m.packageBoughtDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.cap > 0 ? `${formatUsd(m.earned)} / ${formatUsd(m.cap)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!m.bought && (
                        <Button variant="outline" size="sm" onClick={() => remind(m)}>
                          {copiedId === m.userId ? <Check className="h-3.5 w-3.5" /> : "Remind"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile card list */}
      <div className="space-y-2.5 md:hidden">
        {data.members.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No team members yet. Share your invite link to grow your team!
          </Card>
        ) : (
          data.members.map((m) => (
            <Card key={m.userId} className="p-3.5">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.avatar} alt="" width={40} height={40} className="h-10 w-10 rounded-full bg-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{m.displayName}</p>
                    <StatusBadge m={m} />
                  </div>
                  <p className="text-xs text-muted-foreground">{m.username ? `@${m.username}` : "—"}</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Signup</span>
                    <span className="text-right">{fmtDate(m.signupDate)}</span>
                    <span className="text-muted-foreground">Package</span>
                    <span className="text-right">{m.package ?? "—"}{m.isExclusive && " ★"}</span>
                    <span className="text-muted-foreground">Bought</span>
                    <span className="text-right">{fmtDay(m.packageBoughtDate)}</span>
                  </div>
                  {!m.bought && (
                    <Button variant="outline" size="sm" className="mt-2.5 w-full" onClick={() => remind(m)}>
                      {copiedId === m.userId ? <><Check className="h-3.5 w-3.5" /> <span className="ml-1">Copied!</span></> : "Remind to buy"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
