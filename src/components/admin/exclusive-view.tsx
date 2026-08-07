"use client";

import { useState } from "react";
import { Search, Trophy, ShieldAlert, Loader2, PiggyBank, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsd, cn } from "@/lib/utils";
import { TIERS } from "@/lib/tiers";
import type { ExclusiveRow, ExclusiveStats } from "@/lib/exclusive";

const PACKAGES = TIERS.map((t) => ({ id: t.id, label: `${t.name} $${t.price}`, price: t.price }));

function TypeBadge({ type }: { type: ExclusiveRow["activationType"] }) {
  if (type === "NETWORK_ONLY") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gold-400/50 bg-gold-400/10 px-2 py-0.5 text-xs font-semibold text-gold-300">
        NETWORK_ONLY
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
      STANDARD
    </span>
  );
}

export function ExclusiveView({
  initialRows,
  stats,
}: {
  initialRows: ExclusiveRow[];
  stats: ExclusiveStats;
}) {
  const [rows, setRows] = useState<ExclusiveRow[]>(initialRows);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [modalUser, setModalUser] = useState<ExclusiveRow | null>(null);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/exclusive?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (data.ok) setRows(data.rows as ExclusiveRow[]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<Trophy className="h-5 w-5 text-gold-400" />} label="Total Exclusive" value={String(stats.totalExclusive)} />
        <StatCard
          icon={<PiggyBank className="h-5 w-5 text-emerald-400" />}
          label="Company Saved (est.)"
          value={formatUsd(stats.companySaved)}
        />
        <StatCard icon={<Clock className="h-5 w-5 text-amber-400" />} label="Pending (unfunded)" value={String(stats.pending)} />
      </div>

      {/* Search */}
      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email or username… (empty = current exclusive members)"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Upline</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No members found. Try a different email or username.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className="max-w-[200px] truncate font-medium">{r.email}</TableCell>
                    <TableCell>{r.username ? `@${r.username}` : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.uplineName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.package ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><TypeBadge type={r.activationType} /></TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{r.note ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setModalUser(r)}>
                        {r.activationType === "NETWORK_ONLY" ? "Edit" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {modalUser && (
        <ActivateModal
          user={modalUser}
          onClose={() => setModalUser(null)}
          onSaved={() => {
            setModalUser(null);
            runSearch();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

function ActivateModal({
  user,
  onClose,
  onSaved,
}: {
  user: ExclusiveRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [networkOnly, setNetworkOnly] = useState(user.activationType === "NETWORK_ONLY");
  const [tierId, setTierId] = useState<string>(() => {
    const match = PACKAGES.find((p) => user.package?.startsWith(p.label.split(" ")[0]));
    return match?.id ?? "platinum";
  });
  const [note, setNote] = useState(user.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (networkOnly && !note.trim()) {
      setError("A note is required for NETWORK_ONLY activation.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/exclusive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          activationType: networkOnly ? "NETWORK_ONLY" : "STANDARD",
          packageTierId: networkOnly ? tierId : undefined,
          note: networkOnly ? note.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to save. Please try again.");
        return;
      }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gold-400/30 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold-400" />
          <h2 className="text-lg font-bold">Exclusive Activation</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {user.email}
          {user.uplineName ? <> · upline <b className="text-foreground">{user.uplineName}</b></> : null}
        </p>

        {/* Package */}
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Package</label>
        <select
          value={tierId}
          onChange={(e) => setTierId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-400/60"
        >
          {PACKAGES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>

        {/* NETWORK_ONLY toggle */}
        <label className="mb-3 flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
          <input
            type="checkbox"
            checked={networkOnly}
            onChange={(e) => setNetworkOnly(e.target.checked)}
            className="h-4 w-4 accent-gold-400"
          />
          <span className="text-sm font-medium">NETWORK_ONLY (no daily %)</span>
        </label>

        {/* Warning */}
        {networkOnly && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-2.5 text-xs text-gold-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
            <span>
              <b>NETWORK_ONLY</b> = This user gets <b>NO daily %</b>, but KEEPS Direct Referral,
              Indirect Referral, Monthly Bonus &amp; 2nd-Level Unlock. The upline gets <b>ZERO</b> from
              this activation — company save.
            </span>
          </div>
        )}

        {/* Note */}
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Note {networkOnly && <span className="text-loss">*required</span>}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Why is this user exclusive?"
          className="mb-3 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-400/60"
        />

        {error && <p className="mb-3 rounded-md bg-loss/10 px-3 py-2 text-xs text-loss">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : networkOnly ? "Activate NETWORK_ONLY" : "Set STANDARD"}
          </Button>
        </div>
      </div>
    </div>
  );
}
