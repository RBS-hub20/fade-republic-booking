"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TRANSACTION_METHODS, METHOD_LABELS, type TransactionMethod } from "@/lib/constants";

/**
 * Admin-only shortcut to post an APPROVED deposit/withdrawal directly to a
 * specific client from their statement page (no pending step).
 */
export function AddFundsDialog({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<TransactionMethod>("BANK");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, type, amount: value, method, status: "APPROVED", notes }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      setAmount("");
      setNotes("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to add funds");
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Funds
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Funds Directly"
        description={`Post an approved entry to ${clientName} — updates the balance immediately.`}
      >
        <form onSubmit={submit} className="space-y-4">
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
                    type === t ? activeTone : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t === "DEPOSIT" ? "Deposit" : "Withdrawal"}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add {type === "DEPOSIT" ? "Deposit" : "Withdrawal"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
