"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CLIENT_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";

export function AddClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create client");
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Client
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Client"
        description="Creates a client and backfills a 60-day estimated performance history."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" name="name" required />
            <Field label="Account number" name="accountNumber" placeholder="RSC-10004" required />
            <Field label="Email" name="email" type="email" required />
            <Field label="Phone" name="phone" placeholder="+63 …" />
            <Field
              label="Initial deposit (USD)"
              name="initialDeposit"
              type="number"
              defaultValue="10000"
              step="0.01"
              min="0"
            />
            <Field label="Start date" name="startDate" type="date" defaultValue={today} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Select id="country" name="country" defaultValue={DEFAULT_COUNTRY}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue="ACTIVE">
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
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
              Create client
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
