"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatUsd, formatDateKey } from "@/lib/utils";
import { addDays, manilaToday, type EquityPoint } from "@/lib/performance";

const PAGE = 15;

interface LogRow {
  date: string;
  dailyPercent: number;
  pnl: number;
  balance: number;
  placeholder: boolean;
  noTrading: boolean;
}

// Guard against runaway placeholder insertion on very sparse histories.
const MAX_FILL_SPAN = 370;

/**
 * Build a gap-free log: every calendar day between the first recorded day and
 * yesterday gets a row. Days without a recorded entry render as a transparent
 * "0.00% — No trading activity" placeholder (carrying the prior balance), so a
 * missed cron never shows up as an alarming gap in the user's history.
 */
function buildRows(curve: EquityPoint[]): LogRow[] {
  const recorded = curve
    .filter((p) => p.isTradingDay && p.dailyPercent !== 0)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (recorded.length === 0) return [];

  const byDate = new Map(recorded.map((p) => [p.date, p]));
  // Admin-marked "No Trading Day" holidays (posted 0.00%) — surfaced as a
  // richer tooltip on the otherwise-identical placeholder row.
  const noTradingSet = new Set(curve.filter((p) => p.noTrading).map((p) => p.date));
  const yesterday = addDays(manilaToday(), -1);
  const lastRecorded = recorded[recorded.length - 1].date;
  let start = recorded[0].date;
  const end = lastRecorded > yesterday ? lastRecorded : yesterday;
  // Cap the span we fill so a long-dormant account can't generate huge output.
  if (start < addDays(end, -MAX_FILL_SPAN)) start = addDays(end, -MAX_FILL_SPAN);

  const filled: LogRow[] = [];
  let prevBalance = recorded[0].balance;
  for (let k = start; k <= end; k = addDays(k, 1)) {
    const rec = byDate.get(k);
    if (rec) {
      filled.push({ date: k, dailyPercent: rec.dailyPercent, pnl: rec.pnl, balance: rec.balance, placeholder: false, noTrading: false });
      prevBalance = rec.balance;
    } else {
      filled.push({ date: k, dailyPercent: 0, pnl: 0, balance: prevBalance, placeholder: true, noTrading: noTradingSet.has(k) });
    }
  }
  return filled.reverse(); // newest first
}

export function DailyPerformanceTable({ curve }: { curve: EquityPoint[] }) {
  const [limit, setLimit] = useState(PAGE);

  const rows = buildRows(curve);
  const shown = rows.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Performance Log</CardTitle>
        <p className="text-xs text-muted-foreground">
          P/L posts nightly at 11:59 PM PHT. Non-trading days show 0.00% for transparency.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Daily %</TableHead>
              <TableHead className="text-right">Daily P/L</TableHead>
              <TableHead className="text-right">Balance EOD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.date}>
                <TableCell className="font-medium">
                  {formatDateKey(p.date)}
                  {p.placeholder && (
                    <span
                      className="ml-2 text-xs font-normal text-muted-foreground"
                      title={
                        p.noTrading ? "No trading activity - Market closed for holiday" : undefined
                      }
                    >
                      No trading activity
                      {p.noTrading && (
                        <span className="text-amber-500/90"> · Market closed for holiday</span>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "tnum text-right font-medium",
                    p.placeholder
                      ? "text-muted-foreground"
                      : p.dailyPercent >= 0
                      ? "text-profit"
                      : "text-loss"
                  )}
                >
                  {p.dailyPercent.toFixed(2)}%
                </TableCell>
                <TableCell
                  className={cn(
                    "tnum text-right",
                    p.placeholder ? "text-muted-foreground" : p.pnl >= 0 ? "text-profit" : "text-loss"
                  )}
                >
                  {p.placeholder ? "" : p.pnl >= 0 ? "+" : ""}
                  {formatUsd(p.pnl)}
                </TableCell>
                <TableCell className="tnum text-right font-medium">
                  {formatUsd(p.balance)}
                </TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No trading days recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {limit < rows.length && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({rows.length - limit} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
