"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Phone, BadgeCheck, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatUsd, formatDate } from "@/lib/utils";
import { STATUS_LABELS, type ClientStatus } from "@/lib/constants";
import { formatPhoneDisplay, telHref } from "@/lib/phone";

export interface ClientRow {
  id: string;
  name: string;
  email: string;
  username: string | null;
  accountNumber: string;
  status: string;
  activeCapital: number;
  hasMatured: boolean;
  availableWithdrawal: number;
  maturityDate: string | null;
  daysToMaturity: number | null;
  totalNetPnl: number;
  level2Unlocked: boolean;
  activeDirects: number;
  countryCode: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
}

const statusVariant: Record<ClientStatus, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  CLOSED: "danger",
};

type SortKey = "name" | "phone" | "activeCapital" | "netPnl" | "status";

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    let list = rows;
    if (needle) {
      list = rows.filter((r) => {
        const phoneStr = `${r.countryCode ?? ""}${r.phoneNumber ?? ""}`.toLowerCase();
        const hay = [r.name, r.email, r.username ?? "", r.accountNumber, phoneStr]
          .join(" ")
          .toLowerCase();
        // Match text OR a digits-only phone substring (so "9171234567" finds it).
        return hay.includes(needle) || (digits.length >= 3 && (r.phoneNumber ?? "").includes(digits));
      });
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    const cmp = (a: ClientRow, b: ClientRow): number => {
      switch (sort.key) {
        case "phone": {
          // Empty phones always sort last regardless of direction.
          const ap = a.phoneNumber ?? "";
          const bp = b.phoneNumber ?? "";
          if (!ap && !bp) return 0;
          if (!ap) return 1;
          if (!bp) return -1;
          return ap.localeCompare(bp) * dir;
        }
        case "activeCapital":
          return (a.activeCapital - b.activeCapital) * dir;
        case "netPnl":
          return (a.totalNetPnl - b.totalNetPnl) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        default:
          return a.name.localeCompare(b.name) * dir;
      }
    };
    return [...list].sort(cmp);
  }, [rows, q, sort]);

  return (
    <>
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, account, or phone…"
          className="pl-9"
          aria-label="Search clients"
        />
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Client" k="name" sort={sort} onSort={toggleSort} />
              <TableHead>Account</TableHead>
              <SortHead label="Phone" k="phone" sort={sort} onSort={toggleSort} />
              <SortHead label="Active Capital" k="activeCapital" sort={sort} onSort={toggleSort} align="right" />
              <TableHead className="text-right">Available Withdrawal</TableHead>
              <TableHead>Maturity Date</TableHead>
              <SortHead label="Net P/L" k="netPnl" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Status" k="status" sort={sort} onSort={toggleSort} />
              <TableHead className="text-right">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">
                    {c.name}
                    {c.username && (
                      <span className="ml-1.5 text-xs font-normal text-gold-300">@{c.username}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                  {c.level2Unlocked ? (
                    <span className="mt-1 inline-block rounded-full bg-profit/15 px-2 py-0.5 text-[10px] font-semibold text-profit">
                      2nd Level ✅ Unlocked ({c.activeDirects} directs)
                    </span>
                  ) : (
                    <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      2nd Level 🔒 Locked ({c.activeDirects}/3)
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{c.accountNumber}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.phoneNumber ? (
                    <div className="flex flex-col gap-1">
                      <a
                        href={telHref(c.countryCode ?? "+63", c.phoneNumber)}
                        className="text-sm font-medium text-foreground hover:text-gold-300"
                      >
                        {formatPhoneDisplay(c.countryCode ?? "+63", c.phoneNumber)}
                      </a>
                      {c.phoneVerified ? (
                        <Badge variant="success" className="w-fit gap-1">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit">
                          Unverified
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="tnum font-medium text-gold-300">{formatUsd(c.activeCapital)}</div>
                  {c.activeCapital > 0 && (
                    <Badge variant="warning" className="mt-0.5">
                      {c.hasMatured ? "Matured" : "Locked"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="tnum font-medium text-profit">{formatUsd(c.availableWithdrawal)}</div>
                  <Badge variant="success" className="mt-0.5">
                    Withdrawable
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.maturityDate ? (
                    <>
                      <div className="text-sm">{formatDate(c.maturityDate)}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.daysToMaturity != null
                          ? `Unlocks in ${c.daysToMaturity} day${c.daysToMaturity === 1 ? "" : "s"}`
                          : ""}
                      </div>
                    </>
                  ) : c.hasMatured ? (
                    <span className="text-xs font-medium text-profit">Matured</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={cn("tnum text-right", c.totalNetPnl >= 0 ? "text-profit" : "text-loss")}>
                  {c.totalNetPnl >= 0 ? "+" : ""}
                  {formatUsd(c.totalNetPnl)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status as ClientStatus] ?? "outline"}>
                    {STATUS_LABELS[c.status as ClientStatus] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/reports/${c.id}`}>
                      <FileText className="h-4 w-4" /> View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  {q ? "No clients match your search." : "No clients yet. Click “Add Client” to get started."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function SortHead({
  label,
  k,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : ""
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "text-gold-300" : "text-muted-foreground/60")} />
      </button>
    </TableHead>
  );
}
