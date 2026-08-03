"use client";

import { useRouter } from "next/navigation";
import { Download, Info, Crown, Medal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsd, cn } from "@/lib/utils";
import type { TopEarner } from "@/lib/referrals";

function rankBadge(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold-300" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-zinc-300" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-sm font-semibold text-muted-foreground">{rank}</span>;
}

export function TopEarnersView({
  rows, month, monthLabel, monthOptions,
}: {
  rows: TopEarner[];
  month: string;
  monthLabel: string;
  monthOptions: { value: string; label: string }[];
}) {
  const router = useRouter();

  function exportCsv() {
    const head = ["Rank", "Name", "Direct", "Indirect", "Monthly Bonus", "Total", "Month"];
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [
      head.join(","),
      ...rows.map((r) => [r.rank, esc(r.name), r.direct.toFixed(2), r.indirect.toFixed(2), r.bonus.toFixed(2), r.total.toFixed(2), month].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quantumx-top-earners-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-gold-400/25 bg-gold-400/5 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
        <span>Data source: <b className="text-foreground">Direct + Indirect + Monthly Bonus</b>. Grand Total = overall kita. For history, use the month filter.</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Month</span>
          <select
            value={month}
            onChange={(e) => router.push(`/admin/top-earners?month=${e.target.value}`)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Direct</TableHead>
              <TableHead className="text-right">Indirect</TableHead>
              <TableHead className="text-right">Monthly Bonus</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No earnings recorded for {monthLabel}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.userId} className={cn(r.rank <= 3 && "bg-gold-400/5")}>
                  <TableCell><span className="flex h-6 w-6 items-center justify-center">{rankBadge(r.rank)}</span></TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatUsd(r.direct)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatUsd(r.indirect)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatUsd(r.bonus)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-gold-300">{formatUsd(r.total)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{monthLabel}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
