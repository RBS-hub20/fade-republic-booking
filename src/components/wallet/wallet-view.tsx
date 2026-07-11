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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DepositFlow } from "@/components/wallet/deposit-flow";
import { cn, formatUsd, formatDate } from "@/lib/utils";
import type { TransactionMethod, TransactionStatus } from "@/lib/constants";

interface DepositWallet {
  method: "USDT_BEP20" | "USDT_TRC20";
  asset: "USDT";
  network: string;
  networkShort: string;
  address: string;
  memoRequired: boolean;
  explorerUrl: string;
}

interface Txn {
  id: string;
  date: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  method: TransactionMethod;
  status: TransactionStatus;
  notes: string | null;
}

const hasTxHash = (notes: string | null) => !!notes && /TxHash:\s*[A-Za-z0-9x]+/i.test(notes);

/** Map a transaction to a status pill. Deposits use the Waiting→Credited states. */
function pillFor(t: Txn): { label: string; variant: "outline" | "warning" | "danger" | "success" } {
  if (t.type === "DEPOSIT") {
    if (t.status === "APPROVED") return { label: "Credited", variant: "success" };
    if (t.status === "REJECTED") return { label: "Failed", variant: "danger" };
    return hasTxHash(t.notes)
      ? { label: "Confirming", variant: "warning" }
      : { label: "Pending", variant: "warning" };
  }
  if (t.status === "APPROVED") return { label: "Paid", variant: "outline" };
  if (t.status === "REJECTED") return { label: "Rejected", variant: "danger" };
  return { label: "Pending", variant: "warning" };
}

export function WalletView({
  currentBalance,
  wallets,
  bankEnabled,
  limits,
  blobEnabled,
}: {
  currentBalance: number;
  wallets: DepositWallet[];
  bankEnabled: boolean;
  limits: { min: number; max: number };
  blobEnabled: boolean;
}) {
  const [tab, setTab] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
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
        <SummaryCard icon={<Wallet className="h-4 w-4" />} tone="gold" label="Current Balance" value={formatUsd(currentBalance)} />
        <SummaryCard icon={<Clock className="h-4 w-4" />} tone="profit" label="Pending Deposits" value={formatUsd(pendingDeposits)} />
        <SummaryCard icon={<Clock className="h-4 w-4" />} tone="loss" label="Pending Withdrawals" value={formatUsd(pendingWithdrawals)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Deposit / Withdraw */}
        <Card>
          <CardHeader>
            <CardTitle>{tab === "DEPOSIT" ? "Deposit" : "Withdraw"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["DEPOSIT", "WITHDRAWAL"] as const).map((t) => {
                const Icon = t === "DEPOSIT" ? ArrowDownToLine : ArrowUpFromLine;
                const activeTone =
                  t === "DEPOSIT" ? "border-profit bg-profit/15 text-profit" : "border-loss bg-loss/15 text-loss";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
                      tab === t ? activeTone : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t === "DEPOSIT" ? "Deposit" : "Withdrawal"}
                  </button>
                );
              })}
            </div>

            {tab === "DEPOSIT" ? (
              <>
                <DepositFlow wallets={wallets} limits={limits} onChanged={load} blobEnabled={blobEnabled} />
                {!bankEnabled && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Bank transfers are coming soon — USDT only for now.
                  </p>
                )}
              </>
            ) : (
              <WithdrawForm wallets={wallets} onDone={load} />
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
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
                    const pill = pillFor(t);
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
                          <Badge variant={pill.variant}>{pill.label}</Badge>
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

// --- Withdrawal form ---------------------------------------------------------
function WithdrawForm({ wallets, onDone }: { wallets: DepositWallet[]; onDone: () => void }) {
  const [method, setMethod] = useState<DepositWallet["method"]>(wallets[0]?.method ?? "USDT_BEP20");
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const wallet = wallets.find((w) => w.method === method);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!dest.trim()) {
      setError("Enter the wallet address to withdraw to.");
      return;
    }
    const composed = [`Network: ${wallet?.networkShort ?? method}`, `To: ${dest.trim()}`, notes.trim()]
      .filter(Boolean)
      .join(" · ");
    setSubmitting(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "WITHDRAWAL", amount: value, method, notes: composed }),
    });
    setSubmitting(false);
    if (res.ok) {
      setOk(`Withdrawal request for ${formatUsd(value)} submitted — pending approval.`);
      setAmount("");
      setDest("");
      setNotes("");
      onDone();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Request failed");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Network</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {wallets.map((w) => (
            <button
              key={w.method}
              type="button"
              onClick={() => setMethod(w.method)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md border px-2 py-3 transition-colors",
                method === w.method
                  ? "border-gold-400 bg-gold-400/10 text-gold-200"
                  : "border-border hover:bg-accent"
              )}
            >
              <span className="text-sm font-semibold">USDT</span>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {w.networkShort}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="w-amount">Amount (USD)</Label>
        <Input id="w-amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="w-dest">Your USDT ({wallet?.networkShort}) wallet address</Label>
        <Input id="w-dest" placeholder={`Destination ${wallet?.networkShort} address`} value={dest} onChange={(e) => setDest(e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="w-notes">Notes (optional)</Label>
        <Input id="w-notes" placeholder="Reference or message for the admin" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}
      {ok && <p className="rounded-md bg-profit/10 px-3 py-2 text-sm text-profit">{ok}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit Withdrawal Request
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Withdrawals are reviewed and paid out by an admin.
      </p>
    </form>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "gold" | "profit" | "loss";
  label: string;
  value: string;
}) {
  const bg = {
    gold: "bg-gold-400/15 text-gold-300",
    profit: "bg-profit/15 text-profit",
    loss: "bg-loss/15 text-loss",
  }[tone];
  const text = { gold: "text-gold-300", profit: "text-profit", loss: "text-loss" }[tone];
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", bg)}>{icon}</span>
      <div>
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className={cn("tnum text-lg font-semibold", text)}>{value}</p>
      </div>
    </Card>
  );
}
