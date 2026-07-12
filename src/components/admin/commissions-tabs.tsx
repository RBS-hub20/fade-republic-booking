"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn, formatUsd, formatDate } from "@/lib/utils";
import type { DirectRow, IndirectRow, BonusRow, DownlineLedgerRow, PayoutCapRow } from "@/lib/admin-referrals";

function monthLabel(m: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${m}-01T12:00:00Z`)
  );
}

export function CommissionsTabs({
  direct, indirect, bonus, ledger, payoutCap,
}: {
  direct: DirectRow[]; indirect: IndirectRow[]; bonus: BonusRow[]; ledger: DownlineLedgerRow[];
  payoutCap: PayoutCapRow[];
}) {
  const [tab, setTab] = useState<"downline" | "payout" | "direct" | "indirect" | "bonus">("downline");
  const tabs = [
    { id: "downline", label: `By Downline`, n: ledger.length },
    { id: "payout", label: `Payout Cap`, n: payoutCap.length },
    { id: "direct", label: `Direct (1st Level)`, n: direct.length },
    { id: "indirect", label: `Indirect (2nd Level)`, n: indirect.length },
    { id: "bonus", label: `Monthly Bonus`, n: bonus.length },
  ] as const;

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "border-gold-400 bg-gold-400/10 text-gold-200" : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            {t.label} <span className="text-xs opacity-70">({t.n})</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {tab === "downline" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Downline</TableHead>
                <TableHead className="text-right">Total Purchases</TableHead>
                <TableHead className="text-right">Total Renews</TableHead>
                <TableHead className="text-right">Lifetime Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ledger.length === 0 ? <Empty cols={5} /> : ledger.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className="text-sm font-medium">
                      {r.downline}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{r.account}</span>
                    </TableCell>
                    <TableCell className="tnum text-right">{r.totalPurchases}</TableCell>
                    <TableCell className="tnum text-right">{r.totalRenews}</TableCell>
                    <TableCell className="tnum text-right font-semibold text-gold-300">{formatUsd(r.lifetimeCommission)}</TableCell>
                    <TableCell>
                      <Badge variant={r.active ? "success" : "danger"}>{r.active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {tab === "payout" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Total Capital</TableHead>
                <TableHead className="text-right">Max Cap</TableHead>
                <TableHead className="text-right">Total Earned</TableHead>
                <TableHead className="w-40">% Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payoutCap.length === 0 ? <Empty cols={7} /> : payoutCap.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className="text-sm font-medium">
                      {r.user}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{r.account}</span>
                    </TableCell>
                    <TableCell className="tnum text-right">{formatUsd(r.totalCapital)}</TableCell>
                    <TableCell className="tnum text-right">{formatUsd(r.maxCap)}</TableCell>
                    <TableCell className="tnum text-right font-medium text-gold-300">{formatUsd(r.totalEarned)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              r.pctUsed >= 90 ? "bg-loss" : r.pctUsed >= 70 ? "bg-gold-400" : "bg-profit"
                            )}
                            style={{ width: `${Math.max(r.pctUsed, 2)}%` }}
                          />
                        </div>
                        <span className="tnum w-9 text-right text-xs text-muted-foreground">{r.pctUsed}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "CAPPED" ? "danger" : r.status === "INACTIVE" ? "warning" : "success"}>
                        {r.status === "CAPPED" ? "Capped" : r.status === "INACTIVE" ? "Inactive" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tnum text-right">{formatUsd(r.remaining)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {tab === "direct" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Earner</TableHead><TableHead>Referred</TableHead>
                <TableHead>Package</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {direct.length === 0 ? <Empty cols={6} /> : direct.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{r.earner}</TableCell>
                    <TableCell className="text-sm">{r.source}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.packageLabel}</TableCell>
                    <TableCell className="tnum text-right font-medium text-gold-300">{formatUsd(r.amount)}</TableCell>
                    <TableCell><Badge variant="success">Paid</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {tab === "indirect" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Source User</TableHead><TableHead>Direct Upline</TableHead>
                <TableHead className="text-right">Deposit</TableHead><TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {indirect.length === 0 ? <Empty cols={7} /> : indirect.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.date)}</TableCell>
                    <TableCell className="text-sm">{r.source}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.directUpline}</TableCell>
                    <TableCell className="tnum text-right">{formatUsd(r.deposit)}</TableCell>
                    <TableCell className="tnum text-right">{r.rate}%</TableCell>
                    <TableCell className="tnum text-right font-medium text-gold-300">{formatUsd(r.amount)}</TableCell>
                    <TableCell><Badge variant="success">Paid</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {tab === "bonus" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Month</TableHead><TableHead>Earner</TableHead><TableHead className="text-right">Directs</TableHead>
                <TableHead className="text-right">Total P/L</TableHead><TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Bonus</TableHead><TableHead>Paid</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bonus.length === 0 ? <Empty cols={7} /> : bonus.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm font-medium">{monthLabel(r.monthYear)}</TableCell>
                    <TableCell className="text-sm">{r.user}</TableCell>
                    <TableCell className="tnum text-right">{r.directsCount}</TableCell>
                    <TableCell className="tnum text-right">{formatUsd(r.totalDirectsPl)}</TableCell>
                    <TableCell className="tnum text-right">{r.rate}%</TableCell>
                    <TableCell className="tnum text-right font-medium text-gold-300">{formatUsd(r.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.paidAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Empty({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">
        No records yet.
      </TableCell>
    </TableRow>
  );
}
