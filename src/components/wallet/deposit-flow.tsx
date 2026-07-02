"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Clock,
  Radar,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatUsd } from "@/lib/utils";

interface DepositWallet {
  method: "USDT_BEP20" | "USDT_TRC20";
  asset: "USDT";
  network: string;
  networkShort: string;
  address: string;
  memoRequired: boolean;
  explorerUrl: string;
}

type DepositState = "waiting" | "confirming" | "credited" | "failed";

const WINDOW_SECONDS = 30 * 60; // 30-minute payment window
const POLL_MS = 15_000;

interface Active {
  id: string;
  amount: number;
  wallet: DepositWallet;
}

export function DepositFlow({
  wallets,
  limits,
  onChanged,
}: {
  wallets: DepositWallet[];
  limits: { min: number; max: number };
  onChanged: () => void;
}) {
  const router = useRouter();

  const [method, setMethod] = useState<DepositWallet["method"]>(wallets[0]?.method ?? "USDT_BEP20");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [active, setActive] = useState<Active | null>(null);
  const [state, setState] = useState<DepositState>("waiting");
  const [secondsLeft, setSecondsLeft] = useState(WINDOW_SECONDS);
  const [copied, setCopied] = useState(false);

  const [txHash, setTxHash] = useState("");
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txMsg, setTxMsg] = useState<string | null>(null);

  const selectedWallet = wallets.find((w) => w.method === method) ?? wallets[0];

  // ---- Countdown ----
  useEffect(() => {
    if (!active || state === "credited") return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [active, state]);

  // ---- Poll status ----
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poll = useCallback(async () => {
    if (!active) return;
    try {
      const res = await fetch("/api/deposits/status");
      const data = await res.json();
      const d = Array.isArray(data.deposits)
        ? data.deposits.find((x: any) => x.id === active.id)
        : null;
      if (d) {
        setState(d.state as DepositState);
        if (d.state === "credited") {
          onChanged();
          router.refresh(); // refresh server-rendered balance
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    } catch {
      /* keep polling */
    }
  }, [active, onChanged, router]);

  useEffect(() => {
    if (!active) return;
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [active, poll]);

  async function createDeposit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
      setFormError(`Deposit must be between ${formatUsd(limits.min)} and ${formatUsd(limits.max)}.`);
      return;
    }
    setCreating(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "DEPOSIT",
        amount: value,
        method,
        notes: `Network: ${selectedWallet.networkShort}`,
      }),
    });
    const created = await res.json().catch(() => ({}));
    setCreating(false);
    if (res.ok && created?.id) {
      setActive({ id: created.id, amount: value, wallet: selectedWallet });
      setState("waiting");
      setSecondsLeft(WINDOW_SECONDS);
      setTxHash("");
      setTxMsg(null);
      onChanged();
    } else {
      setFormError(created?.error ?? "Could not start the deposit.");
    }
  }

  async function submitTxHash(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !txHash.trim()) return;
    setTxSubmitting(true);
    setTxMsg(null);
    const res = await fetch("/api/deposits/txid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: active.id, txHash: txHash.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setTxSubmitting(false);
    if (res.ok) {
      setState((s) => (s === "waiting" ? "confirming" : s));
      setTxMsg("Transaction submitted — confirming on-chain…");
      poll();
    } else {
      setTxMsg(data.error ?? "Could not submit transaction hash.");
    }
  }

  function copyAddress(addr: string) {
    navigator.clipboard?.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setActive(null);
    setAmount("");
    setState("waiting");
    setFormError(null);
  }

  // ================= FORM =================
  if (!active) {
    return (
      <form onSubmit={createDeposit} className="space-y-4">
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
          <Label htmlFor="dep-amount">Amount (USD)</Label>
          <Input
            id="dep-amount"
            type="number"
            step="0.01"
            min={limits.min}
            max={limits.max}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Min {formatUsd(limits.min)} · Max {formatUsd(limits.max)} per deposit
          </p>
        </div>

        {formError && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{formError}</p>}

        <Button type="submit" className="w-full" disabled={creating}>
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue to payment
        </Button>
      </form>
    );
  }

  // ================= PAYMENT SCREEN =================
  const w = active.wallet;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const expired = secondsLeft === 0 && state !== "credited";

  const badge = {
    waiting: { label: "Waiting for confirmation", cls: "border-gold-400/30 bg-gold-400/10 text-gold-200", icon: <Clock className="h-4 w-4" /> },
    confirming: { label: "Confirming…", cls: "border-gold-400/30 bg-gold-400/10 text-gold-200", icon: <Radar className="h-4 w-4 animate-pulse" /> },
    credited: { label: "Credited", cls: "border-profit/30 bg-profit/10 text-profit", icon: <CheckCircle2 className="h-4 w-4" /> },
    failed: { label: "Failed", cls: "border-loss/30 bg-loss/10 text-loss", icon: <XCircle className="h-4 w-4" /> },
  }[state];

  return (
    <div className="space-y-4">
      <button
        onClick={reset}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> New deposit
      </button>

      {/* Status badge */}
      <div className={cn("flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium", badge.cls)}>
        {badge.icon}
        {badge.label}
      </div>

      {state === "credited" ? (
        <div className="rounded-lg border border-profit/30 bg-profit/10 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-profit" />
          <p className="mt-3 font-semibold text-profit">
            Deposit confirmed — {formatUsd(active.amount)} credited to your balance.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">A confirmation email is on its way.</p>
          <Button className="mt-4" onClick={reset}>
            Make another deposit
          </Button>
        </div>
      ) : (
        <>
          {/* Amount + countdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-card px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Send exactly</p>
              <p className="tnum text-lg font-bold text-gold-300">{formatUsd(active.amount)}</p>
              <p className="text-[11px] text-muted-foreground">in USDT ({w.networkShort})</p>
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Time remaining</p>
              <p className={cn("tnum text-lg font-bold", expired ? "text-loss" : "text-foreground")}>
                {expired ? "Expired" : `${mm}:${ss}`}
              </p>
              <p className="text-[11px] text-muted-foreground">30-minute window</p>
            </div>
          </div>

          {/* QR + address */}
          <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
            <div className="mx-auto w-fit rounded-xl bg-white p-3">
              <QRCodeSVG value={w.address} size={168} level="M" marginSize={0} />
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Deposit address ({w.networkShort})
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all font-mono text-xs">{w.address}</code>
                <Button type="button" variant="outline" size="icon" onClick={() => copyAddress(w.address)} title="Copy">
                  {copied ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-gold-400/10 px-3 py-2 text-xs text-gold-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Only send <strong>USDT ({w.networkShort})</strong> to this address. Other assets or
                networks will be lost forever.
              </span>
            </div>
            <a
              href={w.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gold-300 hover:underline"
            >
              View on explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* TxID input */}
          <form onSubmit={submitTxHash} className="space-y-2">
            <Label htmlFor="dep-txid">Transaction hash (recommended — for instant confirmation)</Label>
            <div className="flex gap-2">
              <Input
                id="dep-txid"
                placeholder="Paste your TxID after sending"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
              <Button type="submit" variant="outline" disabled={txSubmitting || !txHash.trim()}>
                {txSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </Button>
            </div>
            {txMsg && <p className="text-xs text-muted-foreground">{txMsg}</p>}
          </form>

          <p className="text-center text-xs text-muted-foreground">
            This screen updates automatically. Your balance is credited once the transfer is verified
            on-chain.
          </p>
        </>
      )}
    </div>
  );
}
