"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Wallet,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { cn, formatUsd, formatDate } from "@/lib/utils";

interface HistoryRow {
  id: string;
  date: string;
  referredName: string;
  packageLabel: string;
  commission: number;
  status: "PENDING" | "PAID";
}

const PAGE_SIZE = 10;
const MIN_WITHDRAWAL = 10;

export function ReferralHistory({
  history,
  commissionBalance,
}: {
  history: HistoryRow[];
  commissionBalance: number;
}) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [balance, setBalance] = useState(commissionBalance);

  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const rows = useMemo(
    () => history.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [history, page]
  );

  const canWithdraw = balance >= MIN_WITHDRAWAL;

  return (
    <Card className="overflow-hidden rounded-xl border-[#2A2A2A] p-0">
      <div className="flex items-center gap-2 border-b border-[#2A2A2A] p-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold-400/15 text-gold-300">
          <Users className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-bold tracking-tight">Referral History</h2>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/10 text-gold-300">
            <Users className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            No referrals yet. Share your link to start earning!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] text-left">
                {["Date", "Referred User", "Package Purchased", "Commission", "Status"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gold-300",
                      h === "Commission" && "text-right"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#2A2A2A] bg-[#0D0D0D]">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.referredName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.packageLabel}</td>
                  <td className="tnum whitespace-nowrap px-4 py-3 text-right font-semibold text-gold-300">
                    {formatUsd(r.commission)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {history.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-[#2A2A2A] px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Withdraw commission */}
      <div className="flex flex-col gap-3 border-t border-[#2A2A2A] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Commission Balance
          </p>
          <p className="tnum text-lg font-bold text-gold-400">{formatUsd(balance)}</p>
        </div>
        {canWithdraw ? (
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Wallet className="h-4 w-4" /> Withdraw Commission Balance
          </Button>
        ) : (
          <Button
            disabled
            className="cursor-not-allowed bg-secondary text-muted-foreground hover:bg-secondary"
          >
            Minimum ${MIN_WITHDRAWAL} to withdraw
          </Button>
        )}
      </div>

      <WithdrawDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        balance={balance}
        onDone={(newBalance) => {
          setBalance(newBalance);
          setDialogOpen(false);
          router.refresh();
        }}
      />
    </Card>
  );
}

function StatusPill({ status }: { status: "PENDING" | "PAID" }) {
  if (status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#00C851]/15 px-2.5 py-1 text-xs font-semibold text-[#00C851]">
        <Check className="h-3 w-3" /> Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[#FFB800]/15 px-2.5 py-1 text-xs font-semibold text-[#FFB800]">
      Pending
    </span>
  );
}

function WithdrawDialog({
  open,
  onClose,
  balance,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  balance: number;
  onDone: (newBalance: number) => void;
}) {
  const [amount, setAmount] = useState(String(balance));
  const [network, setNetwork] = useState<"USDT_BEP20" | "USDT_TRC20">("USDT_BEP20");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) {
      setError(`Minimum withdrawal is $${MIN_WITHDRAWAL}.`);
      return;
    }
    if (value > balance) {
      setError("Amount exceeds your commission balance.");
      return;
    }
    if (!address.trim()) {
      setError("Enter your payout wallet address.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/referrals/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value, address: address.trim(), network }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      onDone(typeof data.commissionBalance === "number" ? data.commissionBalance : balance - value);
    } else {
      setError(data.error ?? "Withdrawal failed.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Withdraw Commission"
      description="Paid out from your referral commission balance — separate from your trading balance."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="c-amount">Amount (USD)</Label>
          <Input
            id="c-amount"
            type="number"
            step="0.01"
            min={MIN_WITHDRAWAL}
            max={balance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Available: <span className="font-semibold text-gold-300">{formatUsd(balance)}</span>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Network</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["USDT_BEP20", "USDT_TRC20"] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md border px-2 py-3 transition-colors",
                  network === n
                    ? "border-gold-400 bg-gold-400/10 text-gold-200"
                    : "border-border hover:bg-accent"
                )}
              >
                <span className="text-sm font-semibold">USDT</span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {n === "USDT_BEP20" ? "BEP20" : "TRC20"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-address">Payout wallet address</Label>
          <Input
            id="c-address"
            placeholder="Your USDT address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>

        {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Request Withdrawal
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Commission withdrawals are reviewed and paid out by an admin.
        </p>
      </form>
    </Modal>
  );
}
