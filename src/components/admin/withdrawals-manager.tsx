"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ExternalLink,
  Check,
  X,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UploadCloud,
  FileText,
} from "lucide-react";
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
import {
  txidFeedback,
  explorerTxUrl,
  explorerName,
  networkLabel,
  networkFeeUsd,
  shortAddress,
} from "@/lib/tx-validation";
import { useHoldInactivityPause } from "@/lib/inactivity";
import { uploadProof } from "@/lib/proof-upload";

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

export function WithdrawalsManager({
  rows,
  blobEnabled = false,
}: {
  rows: AdminWithdrawal[];
  blobEnabled?: boolean;
}) {
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

      {approve && <ApproveModal w={approve} blobEnabled={blobEnabled} onClose={() => setApprove(null)} />}
      {reject && <RejectModal w={reject} onClose={() => setReject(null)} />}
    </Card>
  );
}

type VerifyState =
  | { status: "idle" | "checking" | "unknown" }
  | { status: "verified" | "pending" | "not_found"; confirmations: number };

function ApproveModal({ w, blobEnabled, onClose }: { w: AdminWithdrawal; blobEnabled: boolean; onClose: () => void }) {
  const router = useRouter();
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verify, setVerify] = useState<VerifyState>({ status: "idle" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Pause the inactivity auto-logout while this proof modal is open — the admin
  // needs time to copy the TXID from their wallet / the explorer.
  useHoldInactivityPause(true, "withdrawal-proof");

  // Revoke object URLs to avoid leaking blobs.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const label = networkLabel(w.network);
  const fb = txidFeedback(w.network, txHash);
  const canSubmit = fb.state === "valid" && !busy;

  async function runVerify(hash: string) {
    if (txidFeedback(w.network, hash).state !== "valid") return;
    setVerify({ status: "checking" });
    try {
      const res = await fetch(
        `/api/admin/verify-tx?network=${w.network}&hash=${encodeURIComponent(hash.trim())}`
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

  function pickFile(f: File | null) {
    setFileError(null);
    if (!f) return;
    const okType = /^(image\/(png|jpe?g)|application\/pdf)$/.test(f.type);
    if (!okType) return setFileError("Use PNG, JPG, or PDF.");
    if (f.size > 5 * 1024 * 1024) return setFileError("Max file size is 5MB.");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(w.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function confirm() {
    if (fb.state !== "valid") return setError(`Enter a valid ${label} transaction hash.`);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/withdrawals/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", txHash: txHash.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "Failed to approve.");
      return;
    }
    // Best-effort proof upload (never blocks the payout confirmation).
    if (file) {
      try {
        await uploadProof({ kind: "withdrawal", refId: w.id, network: w.network, txHash: txHash.trim(), file });
      } catch {
        /* proof is optional — the payout is already recorded */
      }
    }
    setBusy(false);
    router.refresh();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Upload Withdrawal Proof"
      description="Send the USDT from your external wallet first, then record the on-chain TX hash. The platform never sends funds automatically."
    >
      <div className="space-y-3">
        {/* Read-only transfer summary */}
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background/40 p-3 text-sm">
          <Detail label="User" value={w.client} />
          <Detail label={`Network (${label})`} value={label === "TRC20" ? "Tron (TRC20)" : "BNB Smart Chain (BEP20)"} />
          <Detail label="Amount Sent" value={`${w.receiveAmount.toFixed(2)} USDT`} strong />
          <Detail label="Network Fee (est.)" value={`~$${networkFeeUsd(w.network).toFixed(2)}`} />
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Recipient Address</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs" title={w.address}>{shortAddress(w.address, 10, 8)}</p>
              <button type="button" onClick={copyAddr} className="text-muted-foreground hover:text-gold-300" title="Copy address">
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-profit" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="col-span-2">
            <Badge variant="warning" className="capitalize">Status: {w.status === "processing" ? "Sending" : "Sent"}</Badge>
          </div>
        </div>

        {/* TXID + live validation */}
        <div className="space-y-1.5">
          <Label htmlFor="txhash">Transaction Hash (TXID)</Label>
          <Input
            id="txhash"
            placeholder={label === "TRC20" ? "64 hex characters, no 0x" : "0x + 64 hex characters"}
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
        </div>

        {/* Auto-verify + explorer */}
        {fb.state === "valid" && (
          <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5">
              {verify.status === "checking" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking blockchain…</>}
              {verify.status === "verified" && <span className="flex items-center gap-1 text-profit"><CheckCircle2 className="h-3.5 w-3.5" /> Verified — {verify.confirmations} confirmation{verify.confirmations === 1 ? "" : "s"}</span>}
              {verify.status === "pending" && <span className="flex items-center gap-1 text-gold-300"><Clock className="h-3.5 w-3.5" /> Pending — {verify.confirmations} confirmations</span>}
              {verify.status === "not_found" && <span className="flex items-center gap-1 text-loss"><AlertTriangle className="h-3.5 w-3.5" /> Not found on {explorerName(w.network)}</span>}
              {(verify.status === "idle" || verify.status === "unknown") && <span className="text-muted-foreground">On-chain check runs on blur</span>}
            </span>
            <a href={explorerTxUrl(w.network, txHash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-gold-300 hover:underline">
              View on {explorerName(w.network)} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Optional screenshot proof — hidden until a Vercel Blob store is
            connected (BLOB_READ_WRITE_TOKEN). */}
        {blobEnabled && (
        <div className="space-y-1.5">
          <Label>Screenshot (optional)</Label>
          {file ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-background/40 p-2">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="proof" className="h-12 w-12 rounded object-cover" />
              ) : (
                <FileText className="h-8 w-8 text-gold-300" />
              )}
              <span className="flex-1 truncate text-xs">{file.name}</span>
              <button type="button" onClick={() => { setFile(null); setPreview(null); }} className="text-muted-foreground hover:text-loss">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground transition-colors",
                dragOver ? "border-gold-400/60 bg-gold-400/5" : "border-border hover:border-gold-400/40"
              )}
            >
              <UploadCloud className="h-5 w-5" />
              <span>Drag &amp; drop or click — PNG/JPG/PDF, max 5MB</span>
              <span className="text-[10px]">Upload a screenshot from {explorerName(w.network)} for faster verification</span>
              <input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {fileError && <p className="text-xs text-loss">{fileError}</p>}
        </div>
        )}

        {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={confirm} disabled={!canSubmit}>
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
