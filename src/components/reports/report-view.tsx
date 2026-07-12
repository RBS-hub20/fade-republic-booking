"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Check, Pencil, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EquityChart } from "@/components/dashboard/equity-chart";
import { AddFundsDialog } from "@/components/reports/add-funds-dialog";
import { SetPasswordDialog } from "@/components/reports/set-password-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatUsd, formatDate, formatDateKey } from "@/lib/utils";
import { METHOD_LABELS } from "@/lib/constants";
import { generateClientStatement, type ReportTxn } from "@/lib/pdf";
import type { EquityPoint, PerformanceKpis } from "@/lib/performance";
import type { PackageRow } from "@/lib/packages";
import { Lock, Loader2 } from "lucide-react";

interface ReportClient {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  accountNumber: string;
  startDate: string;
  initialDeposit: number;
}

export function ReportView({
  client,
  kpis,
  curve,
  transactions,
  packages,
  canWithdraw,
  isAdmin,
}: {
  client: ReportClient;
  kpis: PerformanceKpis;
  curve: EquityPoint[];
  transactions: ReportTxn[];
  packages: PackageRow[];
  canWithdraw: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();

  function exportPdf() {
    generateClientStatement({
      client: {
        name: client.name,
        email: client.email,
        accountNumber: client.accountNumber,
        startDate: client.startDate,
      },
      kpis,
      curve,
      transactions,
    });
  }

  const dailyRows = curve
    .filter((p) => p.isTradingDay && p.dailyPercent !== 0)
    .slice()
    .reverse();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">{client.name}</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{client.accountNumber}</span> · {client.email}
              {client.phone ? ` · ${client.phone}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Since {formatDate(client.startDate)} · Initial {formatUsd(client.initialDeposit)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <AddFundsDialog clientId={client.id} clientName={client.name} />
                <SetPasswordDialog clientId={client.id} clientEmail={client.email} />
              </>
            )}
            <Button onClick={exportPdf}>
              <FileDown className="h-4 w-4" /> Export Monthly Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Balance" value={formatUsd(kpis.currentBalance)} tone="gold" />
        <Stat label="Deposits" value={formatUsd(kpis.totalDeposits)} />
        <Stat label="Withdrawals" value={formatUsd(kpis.totalWithdrawals)} />
        <Stat
          label="Net P/L"
          value={formatUsd(kpis.totalNetPnl)}
          tone={kpis.totalNetPnl >= 0 ? "profit" : "loss"}
        />
        <Stat label="Win Rate" value={`${kpis.winRate.toFixed(1)}%`} tone="profit" />
        <Stat label="Avg Daily" value={`${kpis.avgDailyPercent.toFixed(2)}%`} tone="gold" />
      </div>

      <EquityChart curve={curve} title="Equity Curve" />

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Deposits & Withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">{t.date}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === "DEPOSIT" ? "success" : "danger"}>
                      {t.type === "DEPOSIT" ? "Deposit" : "Withdrawal"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "tnum text-right font-medium",
                      t.type === "DEPOSIT" ? "text-profit" : "text-loss"
                    )}
                  >
                    {t.type === "DEPOSIT" ? "+" : "−"}
                    {formatUsd(t.amount)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {METHOD_LABELS[t.method as keyof typeof METHOD_LABELS] ?? t.method}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "APPROVED" ? "outline" : "warning"}>
                      {t.status === "APPROVED" ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.notes}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No transactions on record.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Active Packages — locked capital breakdown with unlock dates */}
      <ActivePackagesSection
        packages={packages}
        canWithdraw={canWithdraw}
        onWithdrawn={() => router.refresh()}
      />

      {/* Daily P/L log with admin inline edit */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Performance Log</CardTitle>
          {isAdmin && (
            <p className="text-xs text-muted-foreground">
              Admin: click the pencil to enter an actual daily % (blank = random 0.3–0.6% estimate).
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Daily %</TableHead>
                <TableHead className="text-right">Daily P/L</TableHead>
                <TableHead className="text-right">Balance EOD</TableHead>
                {isAdmin && <TableHead className="text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyRows.map((p) => (
                <DailyRow
                  key={p.date}
                  clientId={client.id}
                  point={p}
                  isAdmin={isAdmin}
                  onSaved={() => router.refresh()}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DailyRow({
  clientId,
  point,
  isAdmin,
  onSaved,
}: {
  clientId: string;
  point: EquityPoint;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(point.dailyPercent.toFixed(2));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, date: point.date, dailyPercent: value }),
    });
    setSaving(false);
    setEditing(false);
    onSaved();
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{formatDateKey(point.date)}</TableCell>
      <TableCell className="text-right">
        {editing ? (
          <Input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="ml-auto h-7 w-24 text-right"
          />
        ) : (
          <span
            className={cn(
              "tnum font-medium",
              point.dailyPercent >= 0 ? "text-profit" : "text-loss"
            )}
          >
            {point.dailyPercent.toFixed(2)}%
          </span>
        )}
      </TableCell>
      <TableCell
        className={cn("tnum text-right", point.pnl >= 0 ? "text-profit" : "text-loss")}
      >
        {point.pnl >= 0 ? "+" : ""}
        {formatUsd(point.pnl)}
      </TableCell>
      <TableCell className="tnum text-right font-medium">{formatUsd(point.balance)}</TableCell>
      {isAdmin && (
        <TableCell className="text-right">
          {editing ? (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={save} disabled={saving} title="Save">
                <Check className="h-4 w-4 text-profit" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(false)}
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} title="Edit %">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

function ActivePackagesSection({
  packages,
  canWithdraw,
  onWithdrawn,
}: {
  packages: PackageRow[];
  canWithdraw: boolean;
  onWithdrawn: () => void;
}) {
  const locked = packages.filter((p) => p.locked);
  const totalLocked = locked.reduce((s, p) => s + p.amount, 0);
  const earliestUnlock = locked.reduce<string | null>(
    (min, p) => (min === null || p.unlockDate < min ? p.unlockDate : min),
    null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gold-300" /> Active Packages
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Your locked capital breakdown with unlock dates
        </p>
      </CardHeader>
      <CardContent>
        {packages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active packages yet. Fund a package to start growing your capital.
          </p>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Unlocks On</TableHead>
                    <TableHead className="text-right">Days Left</TableHead>
                    <TableHead className="w-40">Progress</TableHead>
                    {canWithdraw && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <PackageBadge pkg={p} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(p.purchaseDate)}
                      </TableCell>
                      <TableCell className="tnum text-right font-medium">
                        {formatUsd(p.amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge locked={p.locked} />
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(p.unlockDate)}</TableCell>
                      <TableCell className="tnum text-right">
                        {p.locked ? p.daysLeft : "—"}
                      </TableCell>
                      <TableCell>
                        <ProgressBar pct={p.progressPct} />
                      </TableCell>
                      {canWithdraw && (
                        <TableCell className="text-right">
                          {!p.locked && (
                            <WithdrawButton id={p.id} onDone={onWithdrawn} />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: stacked cards */}
            <div className="space-y-3 sm:hidden">
              {packages.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-card/60 p-4">
                  <div className="flex items-center justify-between">
                    <PackageBadge pkg={p} />
                    <StatusBadge locked={p.locked} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="tnum text-right font-medium">{formatUsd(p.amount)}</span>
                    <span className="text-muted-foreground">Purchased</span>
                    <span className="text-right">{formatDate(p.purchaseDate)}</span>
                    <span className="text-muted-foreground">Unlocks On</span>
                    <span className="text-right">{formatDate(p.unlockDate)}</span>
                    <span className="text-muted-foreground">Days Left</span>
                    <span className="tnum text-right">{p.locked ? p.daysLeft : "—"}</span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar pct={p.progressPct} />
                  </div>
                  {canWithdraw && !p.locked && (
                    <div className="mt-3">
                      <WithdrawButton id={p.id} onDone={onWithdrawn} full />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer totals */}
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                Total Locked:{" "}
                <span className="tnum font-semibold text-gold-300">{formatUsd(totalLocked)}</span>
              </span>
              <span className="text-muted-foreground">
                Earliest Unlock:{" "}
                <span className="font-semibold text-foreground">
                  {earliestUnlock ? formatDate(earliestUnlock) : "—"}
                </span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PackageBadge({ pkg }: { pkg: PackageRow }) {
  const accent =
    pkg.tierId === "platinum"
      ? "border-slate-300/40 text-slate-100"
      : pkg.tierId === "gold"
      ? "border-gold-400/40 text-gold-300"
      : pkg.tierId === "silver"
      ? "border-zinc-300/40 text-zinc-200"
      : pkg.tierId === "bronze"
      ? "border-amber-600/40 text-amber-400"
      : "border-border text-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        accent
      )}
    >
      <span aria-hidden>{pkg.emoji}</span> {pkg.label} {formatUsd(pkg.amount)}
    </span>
  );
}

function StatusBadge({ locked }: { locked: boolean }) {
  return locked ? (
    <Badge variant="warning">🔒 Locked</Badge>
  ) : (
    <Badge variant="success">✅ Unlocked</Badge>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gold-400 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tnum w-9 text-right text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

function WithdrawButton({
  id,
  onDone,
  full,
}: {
  id: string;
  onDone: () => void;
  full?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/capital/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Withdraw failed.");
        return;
      }
      onDone();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(full && "w-full")}>
      <Button
        size="sm"
        variant="outline"
        onClick={withdraw}
        disabled={busy}
        className={cn(full && "w-full")}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Withdraw"}
      </Button>
      {error && <p className="mt-1 text-xs text-loss">{error}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "profit" | "loss" | "gold";
}) {
  const toneClass = {
    neutral: "text-foreground",
    profit: "text-profit",
    loss: "text-loss",
    gold: "text-gold-300",
  }[tone];
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tnum mt-1 text-lg font-bold", toneClass)}>{value}</p>
    </Card>
  );
}
