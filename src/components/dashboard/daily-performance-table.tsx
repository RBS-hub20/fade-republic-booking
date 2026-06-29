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
import type { EquityPoint } from "@/lib/performance";

const PAGE = 15;

export function DailyPerformanceTable({ curve }: { curve: EquityPoint[] }) {
  const [limit, setLimit] = useState(PAGE);

  // Most recent trading days first.
  const rows = curve
    .filter((p) => p.isTradingDay && p.dailyPercent !== 0)
    .slice()
    .reverse();

  const shown = rows.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Performance Log</CardTitle>
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
                <TableCell className="font-medium">{formatDateKey(p.date)}</TableCell>
                <TableCell
                  className={cn(
                    "tnum text-right font-medium",
                    p.dailyPercent >= 0 ? "text-profit" : "text-loss"
                  )}
                >
                  {p.dailyPercent.toFixed(2)}%
                </TableCell>
                <TableCell
                  className={cn(
                    "tnum text-right",
                    p.pnl >= 0 ? "text-profit" : "text-loss"
                  )}
                >
                  {p.pnl >= 0 ? "+" : ""}
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
