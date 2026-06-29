"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  TRANSACTION_TYPES,
  TRANSACTION_METHODS,
  TRANSACTION_STATUSES,
  METHOD_LABELS,
} from "@/lib/constants";

interface ClientOption {
  id: string;
  name: string;
  accountNumber: string;
}

export function AddTransactionDialog({
  clients,
  onCreated,
}: {
  clients: ClientOption[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      onCreated();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add transaction");
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Entry
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Ledger Entry"
        description="Record a deposit or withdrawal. Approved entries update the client balance."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="clientId">Client</Label>
            <Select id="clientId" name="clientId" required defaultValue="">
              <option value="" disabled>
                Select a client…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.accountNumber}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue="DEPOSIT">
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="method">Method</Label>
              <Select id="method" name="method" defaultValue="BANK">
                {TRANSACTION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="APPROVED">
                {TRANSACTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={today} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="Optional" />
          </div>

          {error && (
            <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save entry
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
