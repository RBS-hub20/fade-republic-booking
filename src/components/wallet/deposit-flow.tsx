"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Lock,
  UploadCloud,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatUsd } from "@/lib/utils";
import { tierById } from "@/lib/tiers";
import { txidFeedback, explorerTxUrl, explorerName, networkLabel } from "@/lib/tx-validation";
import { uploadProof } from "@/lib/proof-upload";

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
  const searchParams = useSearchParams();

  // A QX Tiers "Select Package" button links here as
  // /deposit?package=gold&amount=300&locked=1 — pre-fill and (when locked) lock
  // the amount to the package price so it can't be edited.
  const lockedTier =
    searchParams.get("locked") === "1" ? tierById(searchParams.get("package") ?? "") : undefined;
  const presetAmount = (() => {
    if (lockedTier) return String(lockedTier.price);
    const raw = Number(searchParams.get("amount"));
    return Number.isFinite(raw) && raw > 0 ? String(raw) : "";
  })();

  const [method, setMethod] = useState<DepositWallet["method"]>(wallets[0]?.method ?? "USDT_BEP20");
  const [amount, setAmount] = useState(presetAmount);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [active, setActive] = useState<Active | null>(null);
  const [state, setState] = useState<DepositState>("waiting");
  const [secondsLeft, setSecondsLeft] = useState(WINDOW_SECONDS);
  const [copied, setCopied] = useState(false);

  const [txHash, setTxHash] = useState("");
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txMsg, setTxMsg] = useState<string | null>(null);
  const [verify, setVerify] = useState<
    | { status: "idle" | "checking" | "unknown" }
    | { status: "verified" | "pending" | "not_found"; confirmations: number }
  >({ status: "idle" });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  function pickProof(f: File | null) {
    setProofError(null);
    if (!f) return;
    if (!/^(image\/(png|jpe?g)|application\/pdf)$/.test(f.type)) return setProofError("Use PNG, JPG, or PDF.");
    if (f.size > 5 * 1024 * 1024) return setProofError("Max file size is 5MB.");
    setProofFile(f);
  }

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
    // Locked packages always use the package price — never the input value.
    const value = lockedTier ? lockedTier.price : Number(amount);
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
        package: lockedTier?.id,
        notes: `Network: ${selectedWallet.networkShort}${lockedTier ? ` · ${lockedTier.name} Package` : ""}`,
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
    if (!active) return;
    if (txidFeedback(active.wallet.method, txHash).state !== "valid") {
      setTxMsg(`Enter a valid ${networkLabel(active.wallet.method)} transaction hash.`);
      return;
    }
    setTxSubmitting(true);
    setTxMsg(null);
    const res = await fetch("/api/deposits/txid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: active.id, txHash: txHash.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // Best-effort proof upload — never blocks confirmation.
      if (proofFile) {
        try {
          await uploadProof({
            kind: "deposit",
            refId: active.id,
            network: active.wallet.method,
            txHash: txHash.trim(),
            file: proofFile,
          });
        } catch {
          /* proof is optional */
        }
      }
      setTxSubmitting(false);
      setState((s) => (s === "waiting" ? "confirming" : s));
      setTxMsg("Transaction submitted — confirming on-chain…");
      poll();
    } else {
      setTxSubmitting(false);
      setTxMsg(data.error ?? "Could not submit transaction hash.");
    }
  }

  // Best-effort on-chain check (mirrors the admin proof modal). Convenience
  // only — crediting still happens via /api/deposits/txid + status polling.
  async function runVerify(hash: string) {
    if (!active || txidFeedback(active.wallet.method, hash).state !== "valid") return;
    setVerify({ status: "checking" });
    try {
      const res = await fetch(
        `/api/deposits/verify-tx?network=${active.wallet.method}&hash=${encodeURIComponent(hash.trim())}`
      );
      const d = await res.json().catch(() => ({}));
      if (d?.status === "verified" || d?.status === "pending" || d?.status === "not_found") {
        setVerify({ status: d.status, confirmations: Number(d.confirmations ?? 0) });
      } else {
        setVerify({ status: "unknown" });
      }
    } catch {
      setVerify({ status: "unknown" });
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
                  {w.networkShort === "BEP20" ? "BEP20 (BSC)" : "TRC20 (TRON)"}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-loss">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Sending to the wrong network = permanent loss of funds.
          </p>
        </div>

        {lockedTier ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gold-200">
              {lockedTier.name} Package — {formatUsd(lockedTier.price)}
            </p>
            <Label htmlFor="dep-amount">Amount (USD)</Label>
            <div className="relative">
              <Input
                id="dep-amount"
                type="text"
                value={formatUsd(lockedTier.price)}
                readOnly
                aria-readonly
                tabIndex={-1}
                className="cursor-not-allowed bg-secondary/60 pr-9 text-muted-foreground"
              />
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Amount locked for selected package</p>
          </div>
        ) : (
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
        )}

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
            <div className="flex items-start gap-2 rounded-md bg-loss/10 px-3 py-2 text-xs text-loss">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Send <strong>only USDT on the {w.networkShort} network</strong> to this address.
                Sending to the wrong network = <strong>permanent loss of funds</strong>. Double-check
                the network before sending.
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

          {/* TxID input — same validation / auto-verify / explorer as the admin proof modal */}
          {(() => {
            const fb = txidFeedback(w.method, txHash);
            const canSubmit = fb.state === "valid" && !txSubmitting;
            return (
              <form onSubmit={submitTxHash} className="space-y-2">
                <Label htmlFor="dep-txid">Transaction Hash (TXID) — recommended for instant confirmation</Label>
                <div className="flex gap-2">
                  <Input
                    id="dep-txid"
                    placeholder={w.method === "USDT_TRC20" ? "64 hex characters, no 0x" : "0x + 64 hex characters"}
                    value={txHash}
                    onChange={(e) => {
                      setTxHash(e.target.value);
                      setVerify({ status: "idle" });
                    }}
                    onBlur={(e) => runVerify(e.target.value)}
                    className={cn(
                      fb.state === "valid" && "border-profit/60",
                      fb.state === "invalid" && "border-loss/60"
                    )}
                  />
                  <Button type="submit" variant="outline" disabled={!canSubmit}>
                    {txSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                  </Button>
                </div>

                {fb.state === "valid" && (
                  <p className="flex items-center gap-1 text-xs text-profit">
                    <Check className="h-3.5 w-3.5" /> {fb.message}
                  </p>
                )}
                {fb.state === "invalid" && (
                  <p className="flex items-center gap-1 text-xs text-loss">
                    <AlertTriangle className="h-3.5 w-3.5" /> {fb.message}
                  </p>
                )}

                {fb.state === "valid" && (
                  <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      {verify.status === "checking" && (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking blockchain…</>
                      )}
                      {verify.status === "verified" && (
                        <span className="flex items-center gap-1 text-profit">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verified — {verify.confirmations} confirmation{verify.confirmations === 1 ? "" : "s"}
                        </span>
                      )}
                      {verify.status === "pending" && (
                        <span className="flex items-center gap-1 text-gold-300">
                          <Clock className="h-3.5 w-3.5" /> Pending — {verify.confirmations} confirmations
                        </span>
                      )}
                      {verify.status === "not_found" && (
                        <span className="flex items-center gap-1 text-loss">
                          <AlertTriangle className="h-3.5 w-3.5" /> Not found on {explorerName(w.method)}
                        </span>
                      )}
                      {(verify.status === "idle" || verify.status === "unknown") && (
                        <span className="text-muted-foreground">On-chain check runs when you finish typing</span>
                      )}
                    </span>
                    <a
                      href={explorerTxUrl(w.method, txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-medium text-gold-300 hover:underline"
                    >
                      View on {explorerName(w.method)} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {/* Optional deposit screenshot (PNG/JPG/PDF, ≤5MB) */}
                <div className="space-y-1">
                  {proofFile ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5 text-gold-300" />
                      <span className="flex-1 truncate">{proofFile.name}</span>
                      <button type="button" onClick={() => setProofFile(null)} className="text-muted-foreground hover:text-loss">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-gold-400/40">
                      <UploadCloud className="h-3.5 w-3.5" />
                      Attach screenshot (optional) — PNG/JPG/PDF, ≤5MB
                      <input
                        type="file"
                        accept="image/png,image/jpeg,application/pdf"
                        className="hidden"
                        onChange={(e) => pickProof(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                  {proofError && <p className="text-xs text-loss">{proofError}</p>}
                </div>

                {txMsg && <p className="text-xs text-muted-foreground">{txMsg}</p>}
              </form>
            );
          })()}

          <p className="text-center text-xs text-muted-foreground">
            This screen updates automatically. Your balance is credited once the transfer is verified
            on-chain.
          </p>
        </>
      )}
    </div>
  );
}
