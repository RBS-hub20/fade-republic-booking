"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn, formatUsd, formatDate } from "@/lib/utils";
import type { UnlockRow } from "@/lib/admin-referrals";

type Filter = "all" | "unlocked" | "0" | "1" | "2" | "3plus";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unlocked", label: "Unlocked" },
  { id: "0", label: "0/3" },
  { id: "1", label: "1/3" },
  { id: "2", label: "2/3" },
  { id: "3plus", label: "3+ directs" },
];

export function UnlocksTable({ rows }: { rows: UnlockRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    switch (filter) {
      case "unlocked": return rows.filter((r) => r.unlocked);
      case "0": return rows.filter((r) => r.activeDirects === 0);
      case "1": return rows.filter((r) => r.activeDirects === 1);
      case "2": return rows.filter((r) => r.activeDirects === 2);
      case "3plus": return rows.filter((r) => r.activeDirects >= 3);
      default: return rows;
    }
  }, [rows, filter]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.id ? "border-gold-400 bg-gold-400/10 text-gold-200" : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>Tier</TableHead>
              <TableHead className="text-right">Active Capital</TableHead>
              <TableHead className="text-right">Active Directs</TableHead>
              <TableHead>2nd Level</TableHead><TableHead>Unlocked</TableHead>
              <TableHead className="text-right">Tree</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No users match this filter.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant={r.tier === "None" ? "outline" : "gold"}>{r.tier}</Badge></TableCell>
                  <TableCell className="tnum text-right text-gold-300">{formatUsd(r.activeCapital)}</TableCell>
                  <TableCell className={cn("tnum text-right font-medium", r.activeDirects >= 3 ? "text-profit" : "")}>
                    {r.activeDirects}/3
                  </TableCell>
                  <TableCell>
                    {r.unlocked
                      ? <span className="rounded-full bg-profit/15 px-2 py-0.5 text-xs font-semibold text-profit">✅ Unlocked</span>
                      : <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">🔒 Locked</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.unlockedAt ? formatDate(r.unlockedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/referral-tree?user_id=${r.userId}`} className="inline-flex items-center gap-1 text-xs text-gold-300 hover:underline">
                      <GitBranch className="h-3.5 w-3.5" /> View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
