"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Wallet,
  ArrowUpFromLine,
  TrendingUp,
  Target,
  Percent,
  DollarSign,
  Loader2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatUsd, formatPct, formatDate } from "@/lib/utils";
import { PayoutCapCard } from "@/components/finance/payout-cap-card";
import { CoolingCard } from "@/components/finance/cooling-card";
import type { PayoutState } from "@/lib/payout-cap";

export interface CapitalView {
  activeCapital: number;
  maturedCapital: number;
  hasMatured: boolean;
  daysToMaturity: number | null;
  earliestMaturity: string | null;
  maturedDepositIds: string[];
  availableWithdrawal: number;
  totalEarned: number;
  totalWithdrawn: number;
  commissionsEarned: number;
  coolingCapital: number;
  nextProfitAt: string | null;
}

export interface WithdrawalRow {
  id: string;
  amount: number;
  fee: number;
  receiveAmount: number;
  network: string;
  status: string;
  txHash: string | null;
  rejectReason: string | null;
  createdAt: string;
}

const MIN_WITHDRAWAL = 10;

const explorerUrl = (network: string, hash: string) =>
  network === "USDT_TRC20"
    ? `https://tronscan.org/#/transaction/${hash}`
    : `https://bscscan.com/tx/${hash}`;

export function FinancePanel({
  capital,
  kpis,
  withdrawals,
  payout,
  clientId,
}: {
  capital: CapitalView;
  kpis: { winRate: number; avgDailyPercent: number; totalNetPnl: number };
  withdrawals: WithdrawalRow[];
  payout: PayoutState | null;
  clientId: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Payout-cap + cooling cards (top row) */}
      {(payout || capital.coolingCapital > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {payout && <PayoutCapCard payout={payout} clientId={clientId} />}
          {capital.coolingCapital > 0 && (
            <CoolingCard amount={capital.coolingCapital} nextProfitAt={capital.nextProfitAt} />
          )}
        </div>
      )}

      {/* Row 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ActiveCapitalCard capital={capital} />
        <AvailableWithdrawalCard
          available={capital.availableWithdrawal}
          onWithdraw={() => setModalOpen(true)}
        />
        <KpiCard
          label="Referral Earnings"
          value={formatUsd(capital.commissionsEarned)}
          sub="Lifetime commissions"
          icon={DollarSign}
          tone="gold"
        />
        <KpiCard
          label="Total Withdrawn"
          value={formatUsd(capital.totalWithdrawn)}
          icon={ArrowUpFromLine}
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Win Rate" value={formatPct(kpis.winRate, 1)} icon={Target} tone="profit" />
        <KpiCard label="Avg Daily %" value={formatPct(kpis.avgDailyPercent)} icon={Percent} tone="gold" />
        <KpiCard
          label="Total Earned"
          value={formatUsd(capital.totalEarned)}
          sub="Daily P/L + referrals"
          icon={TrendingUp}
          tone="profit"
        />
        <KpiCard
          label="Net P/L"
          value={formatUsd(kpis.totalNetPnl)}
          icon={TrendingUp}
          tone={kpis.totalNetPnl >= 0 ? "profit" : "loss"}
        />
      </div>

      {withdrawals.length > 0 && <WithdrawalHistory rows={withdrawals} />}

      <WithdrawModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        available={capital.availableWithdrawal}
      />
    </div>
  );
}

function ActiveCapitalCard({ capital }: { capital: CapitalView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: "renew" | "withdraw") {
    setBusy(action);
    try {
      for (const id of capital.maturedDepositIds) {
        await fetch(`/api/capital/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Active Capital
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold-400/15 text-gold-300">
          <Lock className="h-4 w-4" />
        </span>
      </div>
      <p className="tnum mt-3 text-2xl font-bold text-gold-300">
        {formatUsd(capital.hasMatured ? capital.maturedCapital + capital.activeCapital : capital.activeCapital)}
      </p>
      {capital.hasMatured ? (
        <>
          <p className="mt-1 text-xs font-medium text-profit">MATURED — Choose Action</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => act("withdraw")} disabled={!!busy}>
              {busy === "withdraw" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Withdraw"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => act("renew")}
              disabled={!!busy}
            >
              {busy === "renew" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Renew 6 Months"}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {capital.daysToMaturity != null
            ? `Locked • Unlocks in ${capital.daysToMaturity} day${capital.daysToMaturity === 1 ? "" : "s"}`
            : "No locked capital yet"}
        </p>
      )}
    </Card>
  );
}

function AvailableWithdrawalCard({
  available,
  onWithdraw,
}: {
  available: number;
  onWithdraw: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Available Withdrawal
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-profit/15 text-profit">
          <Wallet className="h-4 w-4" />
        </span>
      </div>
      <p className="tnum mt-3 text-2xl font-bold text-profit">{formatUsd(available)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Daily P/L + Referrals • $10 min</p>
      <Button
        size="sm"
        className="mt-2 w-full"
        onClick={onWithdraw}
        disabled={available < MIN_WITHDRAWAL}
      >
        {available < MIN_WITHDRAWAL ? `Minimum $${MIN_WITHDRAWAL} to withdraw` : "Withdraw"}
      </Button>
    </Card>
  );
}

function WithdrawModal({
  open,
  onClose,
  available,
}: {
  open: boolean;
  onClose: () => void;
  available: number;
}) {
  const router = useRouter();
  const [network, setNetwork] = useState<"USDT_BEP20" | "USDT_TRC20">("USDT_BEP20");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const value = Number(amount);
  const fee = useMemo(() => (Number.isFinite(value) ? Math.round(value * 3) / 100 : 0), [value]);
  const receive = useMemo(() => Math.round((value - fee) * 100) / 100, [value, fee]);

  const addrOk =
    network === "USDT_BEP20"
      ? /^0x[a-fA-F0-9]{40}$/.test(address.trim())
      : /^T[A-Za-z1-9]{33}$/.test(address.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) return setError(`Minimum withdrawal is $${MIN_WITHDRAWAL}.`);
    if (value > available) return setError("Amount exceeds your available balance.");
    if (!addrOk) return setError("Enter a valid wallet address for the selected network.");
    setSubmitting(true);
    const res = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value, network, address: address.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    } else {
      setError(data.error ?? "Withdrawal failed.");
    }
  }

  function close() {
    setDone(false);
    setError(null);
    setAmount("");
    setAddress("");
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="Withdraw Earnings" description="Paid out from your Available Withdrawal balance.">
      {done ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-profit" />
          <p className="mt-3 font-semibold text-profit">Withdrawal requested</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your request is pending review. Processing time is up to 24 hours — you'll get an email
            with the transaction hash once it's sent.
          </p>
          <Button className="mt-4" onClick={close}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Available Balance</span>
            <span className="tnum font-semibold text-profit">{formatUsd(available)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Minimum withdrawal: $10.00</p>

          <div className="space-y-1.5">
            <Label>Network</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["USDT_BEP20", "USDT_TRC20"] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNetwork(n)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition-colors",
                    network === n
                      ? "border-gold-400 bg-gold-400/10 text-gold-200"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {n === "USDT_BEP20" ? "BEP20 USDT" : "TRC20 USDT"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wd-amount">Amount (USD)</Label>
            <Input
              id="wd-amount"
              type="number"
              step="0.01"
              min={MIN_WITHDRAWAL}
              max={available}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1 rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Fee (3%)</span>
              <span className="tnum text-loss">−{formatUsd(fee || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">You Will Receive</span>
              <span className="tnum text-lg font-bold text-profit">{formatUsd(receive > 0 ? receive : 0)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wd-address">Wallet Address</Label>
            <Input
              id="wd-address"
              placeholder={network === "USDT_BEP20" ? "0x…" : "T…"}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <p className="text-xs text-muted-foreground">Processing time: 24 hours</p>
          {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Request Withdrawal
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function WithdrawalHistory({ rows }: { rows: WithdrawalRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <ArrowUpFromLine className="h-4 w-4 text-gold-300" />
        <h3 className="text-sm font-semibold">Withdrawals</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Requested</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>TX Hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(w.createdAt)}
                </TableCell>
                <TableCell className="tnum text-right">{formatUsd(w.amount)}</TableCell>
                <TableCell className="tnum text-right text-loss">{formatUsd(w.fee)}</TableCell>
                <TableCell className="tnum text-right font-medium text-profit">
                  {formatUsd(w.receiveAmount)}
                </TableCell>
                <TableCell className="text-xs">
                  {w.network === "USDT_TRC20" ? "TRC20" : "BEP20"}
                </TableCell>
                <TableCell>
                  <WStatus status={w.status} reason={w.rejectReason} />
                </TableCell>
                <TableCell className="text-xs">
                  {w.status === "completed" && w.txHash ? (
                    <a
                      href={explorerUrl(w.network, w.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-gold-300 hover:underline"
                    >
                      {w.txHash.slice(0, 8)}…{w.txHash.slice(-6)} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : w.status === "rejected" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" /> Processing…
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function WStatus({ status, reason }: { status: string; reason: string | null }) {
  const map: Record<string, { label: string; variant: "warning" | "outline" | "success" | "danger" }> = {
    pending: { label: "Pending", variant: "warning" },
    processing: { label: "Processing", variant: "outline" },
    completed: { label: "Completed", variant: "success" },
    rejected: { label: "Rejected", variant: "danger" },
  };
  const s = map[status] ?? { label: status, variant: "outline" as const };
  return (
    <span title={status === "rejected" && reason ? reason : undefined}>
      <Badge variant={s.variant}>{s.label}</Badge>
    </span>
  );
}
