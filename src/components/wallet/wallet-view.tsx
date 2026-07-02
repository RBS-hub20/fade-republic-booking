"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Wallet,
  Clock,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Landmark,
  Radar,
  CheckCircle2,
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
import { cn, formatUsd, formatDate } from "@/lib/utils";
import { METHOD_LABELS, STATUS_BADGE, type TransactionMethod, type TransactionStatus } from "@/lib/constants";

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

export function WalletView({
  currentBalance,
  wallets,
  bankEnabled,
  limits,
}: {
  currentBalance: number;
  wallets: DepositWallet[];
  bankEnabled: boolean;
  limits: { min: number; max: number };
}) {
  const [tab, setTab] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [method, setMethod] = useState<TransactionMethod>(wallets[0]?.method ?? "USDT_BEP20");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [destAddress, setDestAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  // Near-real-time deposit confirmation poller.
  const [pendingCheck, setPendingCheck] = useState<{ id: string; amount: number } | null>(null);
  const [checkStatus, setCheckStatus] = useState<"idle" | "checking" | "confirmed" | "timeout">("idle");
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);

  const selectedWallet = wallets.find((w) => w.method === method);
  const isCrypto = method === "USDT_BEP20" || method === "USDT_TRC20";

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

  // Poll for near-real-time confirmation after a deposit with a TxID is filed.
  useEffect(() => {
    if (!pendingCheck) return;
    let stop = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (stop) return;
      attempt += 1;
      setCheckAttempt(attempt);
      // Ask the server to verify our own pending deposits on-chain.
      try {
        await fetch("/api/deposits/check", { method: "POST" });
      } catch {
        /* ignore transient errors */
      }
      // Reload and inspect the tracked deposit.
      let list: Txn[] = [];
      try {
        const res = await fetch("/api/transactions");
        const data = await res.json();
        if (Array.isArray(data)) {
          list = data;
          setTxns(data);
        }
      } catch {
        /* ignore */
      }
      const tracked = list.find((t) => t.id === pendingCheck!.id);
      if (tracked?.status === "APPROVED") {
        setConfirmedAmount(tracked.amount);
        setCheckStatus("confirmed");
        setPendingCheck(null);
        return;
      }
      if (tracked?.status === "REJECTED") {
        setCheckStatus("timeout");
        setPendingCheck(null);
        return;
      }
      if (attempt >= 10) {
        setCheckStatus("timeout");
        setPendingCheck(null);
        return;
      }
      timer = setTimeout(tick, 18_000);
    }

    timer = setTimeout(tick, 5_000); // first check ~5s after submitting
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [pendingCheck]);

  function copyAddress(addr: string) {
    navigator.clipboard?.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (tab === "DEPOSIT" && (value < limits.min || value > limits.max)) {
      setError(
        `Deposit must be between ${formatUsd(limits.min)} and ${formatUsd(limits.max)}.`
      );
      return;
    }
    if (tab === "WITHDRAWAL" && isCrypto && !destAddress.trim()) {
      setError("Enter the wallet address to withdraw to.");
      return;
    }

    // Build structured notes so the admin can verify on-chain.
    const parts: string[] = [];
    if (isCrypto) parts.push(`Network: ${selectedWallet?.networkShort ?? method}`);
    if (tab === "DEPOSIT" && txHash.trim()) parts.push(`TxHash: ${txHash.trim()}`);
    if (tab === "WITHDRAWAL" && destAddress.trim()) parts.push(`To: ${destAddress.trim()}`);
    if (notes.trim()) parts.push(notes.trim());
    const composedNotes = parts.join(" · ");

    setSubmitting(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab, amount: value, method, notes: composedNotes }),
    });
    const created = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      setOk(
        `${tab === "DEPOSIT" ? "Deposit" : "Withdrawal"} request for ${formatUsd(value)} submitted — ` +
          "pending approval."
      );
      // Start near-real-time verification if this was a crypto deposit with a TxID.
      if (tab === "DEPOSIT" && isCrypto && txHash.trim() && created?.id) {
        setConfirmedAmount(null);
        setCheckAttempt(0);
        setCheckStatus("checking");
        setPendingCheck({ id: created.id, amount: value });
      }
      setAmount("");
      setTxHash("");
      setDestAddress("");
      setNotes("");
      load();
    } else {
      setError(created?.error ?? "Request failed");
    }
  }

  const pendingDeposits = txns
    .filter((t) => t.type === "DEPOSIT" && t.status === "PENDING")
    .reduce((s, t) => s + t.amount, 0);
  const pendingWithdrawals = txns
    .filter((t) => t.type === "WITHDRAWAL" && t.status === "PENDING")
    .reduce((s, t) => s + t.amount, 0);

  // Payment method options for the selector.
  const methodOptions: { method: TransactionMethod; label: string; sub: string; disabled?: boolean }[] = [
    ...wallets.map((w) => ({ method: w.method, label: "USDT", sub: w.networkShort })),
    { method: "BANK" as TransactionMethod, label: "Bank", sub: bankEnabled ? "Transfer" : "Soon", disabled: !bankEnabled },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Wallet className="h-4 w-4" />} tone="gold" label="Current Balance" value={formatUsd(currentBalance)} />
        <SummaryCard icon={<Clock className="h-4 w-4" />} tone="profit" label="Pending Deposits" value={formatUsd(pendingDeposits)} />
        <SummaryCard icon={<Clock className="h-4 w-4" />} tone="loss" label="Pending Withdrawals" value={formatUsd(pendingWithdrawals)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Request form / gateway */}
        <Card>
          <CardHeader>
            <CardTitle>New Request</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Deposit / Withdraw toggle */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["DEPOSIT", "WITHDRAWAL"] as const).map((t) => {
                const Icon = t === "DEPOSIT" ? ArrowDownToLine : ArrowUpFromLine;
                const activeTone =
                  t === "DEPOSIT" ? "border-profit bg-profit/15 text-profit" : "border-loss bg-loss/15 text-loss";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTab(t);
                      setError(null);
                      setOk(null);
                    }}
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

            {/* Method selector */}
            <Label>Payment method</Label>
            <div className="mb-4 mt-1.5 grid grid-cols-3 gap-2">
              {methodOptions.map((m) => {
                const active = method === m.method;
                const Icon = m.method === "BANK" ? Landmark : Wallet;
                return (
                  <button
                    key={m.method}
                    type="button"
                    disabled={m.disabled}
                    onClick={() => {
                      setMethod(m.method);
                      setError(null);
                      setOk(null);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-center transition-colors",
                      m.disabled
                        ? "cursor-not-allowed border-border/60 opacity-50"
                        : active
                        ? "border-gold-400 bg-gold-400/10 text-gold-200"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold">{m.label}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.sub}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {/* Deposit + crypto → show the receive gateway */}
              {tab === "DEPOSIT" && isCrypto && selectedWallet && (
                <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-bold">USDT</span>
                    <Badge variant="outline">{selectedWallet.network}</Badge>
                  </div>

                  <div className="mx-auto w-fit rounded-xl bg-white p-3">
                    <QRCodeSVG value={selectedWallet.address} size={168} level="M" marginSize={0} />
                  </div>

                  <div className="rounded-md border border-border bg-card px-3 py-2">
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Deposit address ({selectedWallet.networkShort})
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all font-mono text-xs text-foreground">
                        {selectedWallet.address}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyAddress(selectedWallet.address)}
                        title="Copy address"
                      >
                        {copied ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-md bg-gold-400/10 px-3 py-2 text-xs text-gold-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Only send <strong>USDT ({selectedWallet.networkShort})</strong> to this address.
                      Sending any other asset or network will be lost forever.
                    </span>
                  </div>

                  <a
                    href={selectedWallet.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gold-300 hover:underline"
                  >
                    View on explorer <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Bank coming soon */}
              {method === "BANK" && !bankEnabled && (
                <div className="rounded-md border border-border bg-background/40 px-3 py-4 text-center text-sm text-muted-foreground">
                  Bank transfers are coming soon. Please use USDT for now.
                </div>
              )}

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
                {tab === "DEPOSIT" && (
                  <p className="text-xs text-muted-foreground">
                    Min {formatUsd(limits.min)} · Max {formatUsd(limits.max)} per deposit
                  </p>
                )}
              </div>

              {/* Deposit crypto → optional tx hash */}
              {tab === "DEPOSIT" && isCrypto && (
                <div className="space-y-1.5">
                  <Label htmlFor="txhash">Transaction hash (recommended)</Label>
                  <Input
                    id="txhash"
                    placeholder="Paste your TxID after sending — enables instant confirmation"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                  />
                </div>
              )}

              {/* Withdrawal crypto → destination address */}
              {tab === "WITHDRAWAL" && isCrypto && (
                <div className="space-y-1.5">
                  <Label htmlFor="dest">
                    Your USDT ({selectedWallet?.networkShort}) wallet address
                  </Label>
                  <Input
                    id="dest"
                    placeholder={`Destination ${selectedWallet?.networkShort} address`}
                    value={destAddress}
                    onChange={(e) => setDestAddress(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  placeholder="Reference or message for the admin"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}
              {ok && !pendingCheck && checkStatus !== "confirmed" && (
                <p className="rounded-md bg-profit/10 px-3 py-2 text-sm text-profit">{ok}</p>
              )}

              {/* Near-real-time confirmation status */}
              {checkStatus === "checking" && (
                <div className="flex items-center gap-2 rounded-md border border-gold-400/30 bg-gold-400/10 px-3 py-2.5 text-sm text-gold-200">
                  <Radar className="h-4 w-4 shrink-0 animate-pulse" />
                  <span>Checking your transaction on-chain… (attempt {checkAttempt}/10)</span>
                </div>
              )}
              {checkStatus === "confirmed" && (
                <div className="flex items-center gap-2 rounded-md border border-profit/30 bg-profit/10 px-3 py-2.5 text-sm text-profit">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Deposit confirmed! {formatUsd(confirmedAmount ?? 0)} credited to your balance.
                  </span>
                </div>
              )}
              {checkStatus === "timeout" && (
                <div className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
                  Still confirming — this can take a few minutes. Your balance updates automatically
                  once the transaction is verified.
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting || (method === "BANK" && !bankEnabled)}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {tab === "DEPOSIT" ? "I've sent it — Submit Deposit" : "Submit Withdrawal Request"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {tab === "DEPOSIT"
                  ? "Send the USDT, then submit — an admin confirms on-chain before your balance updates."
                  : "Withdrawals are reviewed and paid out by an admin."}
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
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : txns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                        <TableCell className="whitespace-nowrap text-xs">
                          {METHOD_LABELS[t.method] ?? t.method}
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
