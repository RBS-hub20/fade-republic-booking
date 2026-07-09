"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
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

export interface AdminWithdrawal {
  id: string;
  client: string;
  amount: number;
  fee: number;
  receiveAmount: number;
  network: string;
  address: string;
  status: string;
  txHash: string | null;
  rejectReason: string | null;
  createdAt: string;
}

const STATUS: Record<string, "warning" | "outline" | "success" | "danger"> = {
  pending: "warning",
  processing: "outline",
  completed: "success",
  rejected: "danger",
};

export function WithdrawalsManager({ rows }: { rows: AdminWithdrawal[] }) {
  const [approve, setApprove] = useState<AdminWithdrawal | null>(null);
  const [reject, setReject] = useState<AdminWithdrawal | null>(null);

  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Receive</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No withdrawal requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="whitespace-nowrap text-sm font-medium">{w.client}</TableCell>
                    <TableCell className="tnum text-right">{formatUsd(w.amount)}</TableCell>
                    <TableCell className="tnum text-right text-loss">{formatUsd(w.fee)}</TableCell>
                    <TableCell className="tnum text-right font-medium text-profit">
                      {formatUsd(w.receiveAmount)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {w.network === "USDT_TRC20" ? "TRC20" : "BEP20"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-xs" title={w.address}>
                      {w.address}
                    </TableCell>
                    <TableCell>
                      <span title={w.status === "rejected" && w.rejectReason ? w.rejectReason : undefined}>
                        <Badge variant={STATUS[w.status] ?? "outline"} className="capitalize">
                          {w.status}
                        </Badge>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(w.createdAt, { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-right">
                      {w.status === "pending" || w.status === "processing" ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => setApprove(w)}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => setReject(w)}>
                            Reject
                          </Button>
                        </div>
                      ) : w.status === "completed" && w.txHash ? (
                        <a
                          href={
                            w.network === "USDT_TRC20"
                              ? `https://tronscan.org/#/transaction/${w.txHash}`
                              : `https://bscscan.com/tx/${w.txHash}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-gold-300 hover:underline"
                        >
                          TX <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {approve && <ApproveModal w={approve} onClose={() => setApprove(null)} />}
      {reject && <RejectModal w={reject} onClose={() => setReject(null)} />}
    </Card>
  );
}

function ApproveModal({ w, onClose }: { w: AdminWithdrawal; onClose: () => void }) {
  const router = useRouter();
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!txHash.trim()) return setError("Transaction hash is required.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/withdrawals/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", txHash: txHash.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      setError(data.error ?? "Failed to approve.");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Approve & Send Email"
      description="Send the USDT from your external wallet first, then paste the on-chain TX hash below. The platform does not send funds automatically."
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background/40 p-3 text-sm">
          <Detail label="User" value={w.client} />
          <Detail label="Network" value={w.network === "USDT_TRC20" ? "TRC20" : "BEP20"} />
          <Detail label="Requested" value={formatUsd(w.amount)} />
          <Detail label="Fee (3%)" value={formatUsd(w.fee)} />
          <Detail label="Amount to Send" value={formatUsd(w.receiveAmount)} strong />
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Address</p>
            <p className="break-all font-mono text-xs">{w.address}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="txhash">Transaction Hash</Label>
          <Input
            id="txhash"
            placeholder="Paste transaction hash here"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
          />
        </div>
        {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirm &amp; Send Email
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RejectModal({ w, onClose }: { w: AdminWithdrawal; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!reason.trim()) return setError("A reason is required.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/withdrawals/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      setError(data.error ?? "Failed to reject.");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reject Withdrawal"
      description={`${w.client} • ${formatUsd(w.amount)} — the amount will be refunded to their Available Withdrawal.`}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            placeholder="e.g. Invalid wallet address"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Confirm Reject
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm", strong && "font-bold text-gold-300")}>{value}</p>
    </div>
  );
}
