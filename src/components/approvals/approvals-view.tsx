"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, Inbox, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { METHOD_LABELS, type TransactionMethod } from "@/lib/constants";

interface PendingTxn {
  id: string;
  date: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  method: TransactionMethod;
  notes: string | null;
  client: { name: string; accountNumber: string };
}

export function ApprovalsView({ pending }: { pending: PendingTxn[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  async function act(id: string, status: "APPROVED" | "REJECTED") {
    setBusy(id);
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    router.refresh();
  }

  async function verifyOnChain() {
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await fetch("/api/deposits/verify", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setVerifyMsg(
          `Checked ${data.checked ?? 0} USDT deposit(s), auto-approved ${data.approved ?? 0}.` +
            (data.bep20Enabled === false ? " (BEP20 verification off — set BSCSCAN_API_KEY)" : "")
        );
        router.refresh();
      } else {
        setVerifyMsg(data.error ?? "Verification failed");
      }
    } catch {
      setVerifyMsg("Verification failed");
    }
    setVerifying(false);
  }

  const actionBar = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {verifyMsg ?? "Auto-approve USDT deposits by matching their on-chain transaction."}
      </p>
      <Button variant="outline" size="sm" onClick={verifyOnChain} disabled={verifying}>
        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Verify USDT deposits on-chain
      </Button>
    </div>
  );

  if (pending.length === 0) {
    return (
      <>
        {actionBar}
        <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Inbox className="h-6 w-6" />
          </span>
          <p className="font-medium">No pending requests</p>
          <p className="text-sm text-muted-foreground">
            Deposit and withdrawal requests from clients will appear here for review.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      {actionBar}
      <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatDate(t.date)}
              </TableCell>
              <TableCell>
                <div className="font-medium">{t.client.name}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {t.client.accountNumber}
                </div>
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
              <TableCell className="text-sm">{METHOD_LABELS[t.method] ?? t.method}</TableCell>
              <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                {t.notes}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => act(t.id, "APPROVED")}
                    disabled={busy === t.id}
                  >
                    {busy === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(t.id, "REJECTED")}
                    disabled={busy === t.id}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </Card>
    </>
  );
}
