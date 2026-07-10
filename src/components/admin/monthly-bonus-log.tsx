"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatUsd, formatDate } from "@/lib/utils";
import type { BonusRow } from "@/lib/admin-referrals";

function monthLabel(m: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${m}-01T12:00:00Z`)
  );
}

export function MonthlyBonusLog({
  rows, months, selected,
}: {
  rows: BonusRow[]; months: string[]; selected: string;
}) {
  const router = useRouter();
  const total = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

  function exportCsv() {
    const header = ["Month", "User", "Directs", "Total P/L", "Rate %", "Bonus", "Paid At"];
    const lines = rows.map((r) =>
      [r.monthYear, r.user, r.directsCount, r.totalDirectsPl.toFixed(2), r.rate, r.amount.toFixed(2), new Date(r.paidAt).toISOString()]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-bonus-${selected || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <Select
            value={selected}
            onChange={(e) => router.push(`/admin/monthly-bonus${e.target.value ? `?month=${e.target.value}` : ""}`)}
          >
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>Month</TableHead><TableHead className="text-right">Directs</TableHead>
              <TableHead className="text-right">Total P/L</TableHead><TableHead className="text-right">5% Bonus</TableHead>
              <TableHead>Status</TableHead><TableHead>Paid At</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No bonuses paid yet.</TableCell></TableRow>
              ) : (
                <>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-medium">{r.user}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{monthLabel(r.monthYear)}</TableCell>
                      <TableCell className="tnum text-right">{r.directsCount}</TableCell>
                      <TableCell className="tnum text-right">{formatUsd(r.totalDirectsPl)}</TableCell>
                      <TableCell className="tnum text-right font-medium text-gold-300">{formatUsd(r.amount)}</TableCell>
                      <TableCell><span className="rounded-full bg-[#00C851]/15 px-2 py-0.5 text-xs font-semibold text-[#00C851]">Paid</span></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.paidAt, { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border">
                    <TableCell colSpan={4} className="text-right text-sm font-semibold">Total bonuses paid</TableCell>
                    <TableCell className="tnum text-right text-base font-bold text-gold-400">{formatUsd(total)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
