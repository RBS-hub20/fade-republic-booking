"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Globe2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COUNTRIES, DEFAULT_COUNTRY, countryFlag } from "@/lib/countries";

export interface UserCountryRow {
  id: string;
  name: string;
  email: string;
  username: string | null;
  country: string | null;
  countryName: string | null;
  hasClient: boolean;
}

/**
 * Bulk "Set Country" migration tool: pick users (or filter to those missing a
 * country), choose a country, Apply. Writes User + mirrors to the linked Client.
 */
export function UsersCountryTable({ rows }: { rows: UserCountryRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyMissing && r.country) return false;
      if (!needle) return true;
      return [r.name, r.email, r.username ?? "", r.countryName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, onlyMissing]);

  const allShownSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAllShown() {
    setSelected((s) => {
      const next = new Set(s);
      if (allShownSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  async function apply() {
    if (selected.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users/set-country", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selected), country }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Failed to set country");
      setMsg(`Updated ${data.updated} user${data.updated === 1 ? "" : "s"} → ${data.countryName}.`);
      setSelected(new Set());
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Globe2 className="h-4 w-4 text-gold-300" />
          <span className="font-medium">{selected.size} selected</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-56"
            aria-label="Country to set"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </Select>
          <Button onClick={apply} disabled={busy || selected.size === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Set Country
          </Button>
        </div>
      </Card>

      {msg && <p className="text-sm text-gold-300">{msg}</p>}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, username…"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
            className="h-4 w-4 accent-gold-400"
          />
          Only users without a country
        </label>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  onChange={toggleAllShown}
                  className="h-4 w-4 accent-gold-400"
                  aria-label="Select all shown"
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Account</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className={selected.has(r.id) ? "bg-gold-400/5" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 accent-gold-400"
                    aria-label={`Select ${r.email}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {r.name}
                    {r.username && (
                      <span className="ml-1.5 text-xs font-normal text-gold-300">@{r.username}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.countryName ? (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span aria-hidden>{countryFlag(r.country ?? "")}</span>
                      {r.countryName}
                    </span>
                  ) : (
                    <Badge variant="outline">No country</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.hasClient ? (
                    <Badge variant="success">Client</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No users match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
