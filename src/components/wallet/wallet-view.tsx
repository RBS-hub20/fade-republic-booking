"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Wallet,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatUsd, formatDate } from "@/lib/utils";
import {
  TRANSACTION_METHODS,
  METHOD_LABELS,
  STATUS_BADGE,
  type TransactionMethod,
  type TransactionStatus,
} from "@/lib/constants";

interface Txn {
  id: string;
  date: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  method: TransactionMethod;
  status: TransactionStatus;
  notes: string | null;
}

export function WalletView({ currentBalance }: { currentBalance: number }) {
  const [type, setType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<TransactionMethod>("BANK");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/transactions");
    const data = await res.json();
    setTxns(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount: value, method, notes }),
    });
    setSubmitting(false);
    if (res.ok) {
      setOk(
        `${type === "DEPOSIT" ? "Deposit" : "Withdrawal"} request for ${formatUsd(
          value
        )} submitted — pending admin approval.`
      );
      setAmount("");
      setNotes("");
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Request failed");
    }
  }

  const pendingDeposits = txns
    .filter((t) => t.type === "DEPOSIT" && t.status === "PENDING")
    .reduce((s, t) => s + t.amount, 0);
  const pendingWithdrawals = txns
    .filter((t) => t.type === "WITHDRAWAL" && t.status === "PENDING")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gold-400/15 text-gold-300">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Current Balance</p>
            <p className="tnum text-lg font-bold text-gold-300">{formatUsd(currentBalance)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-profit/15 text-profit">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Pending Deposits</p>
            <p className="tnum text-lg font-semibold text-profit">{formatUsd(pendingDeposits)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-loss/15 text-loss">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Pending Withdrawals</p>
            <p className="tnum text-lg font-semibold text-loss">{formatUsd(pendingWithdrawals)}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Request form */}
        <Card>
          <CardHeader>
            <CardTitle>New Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2">
                {(["DEPOSIT", "WITHDRAWAL"] as const).map((t) => {
                  const Icon = t === "DEPOSIT" ? ArrowDownToLine : ArrowUpFromLine;
                  const activeTone =
                    t === "DEPOSIT"
                      ? "border-profit bg-profit/15 text-profit"
                      : "border-loss bg-loss/15 text-loss";
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
                        type === t
                          ? activeTone
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t === "DEPOSIT" ? "Deposit" : "Withdrawal"}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="method">Method</Label>
                <Select
                  id="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as TransactionMethod)}
                >
                  {TRANSACTION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  placeholder="Reference, wallet address, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {error && (
                <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
              )}
              {ok && (
                <p className="rounded-md bg-profit/10 px-3 py-2 text-sm text-profit">{ok}</p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit {type === "DEPOSIT" ? "Deposit" : "Withdrawal"} Request
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Requests are reviewed by an admin before your balance updates.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Request History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : txns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No requests yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  txns.map((t) => {
                    const badge = STATUS_BADGE[t.status];
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(t.date)}
                        </TableCell>
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
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
