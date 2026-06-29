"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Upload, Check, Trash2, Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { AddTransactionDialog } from "./add-transaction-dialog";
import { cn, formatUsd, formatDate } from "@/lib/utils";
import { METHOD_LABELS, type TransactionMethod } from "@/lib/constants";

interface ClientOption {
  id: string;
  name: string;
  accountNumber: string;
}

interface Txn {
  id: string;
  date: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  method: TransactionMethod;
  status: "PENDING" | "APPROVED";
  notes: string | null;
  client: { name: string; accountNumber: string };
}

export function LedgerView({
  clients,
  isAdmin,
}: {
  clients: ClientOption[];
  isAdmin: boolean;
}) {
  const [clientId, setClientId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useCallback(() => {
    const p = new URLSearchParams();
    if (clientId !== "all") p.set("clientId", clientId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [clientId, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/transactions?${query()}`);
    const data = await res.json();
    setTxns(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this ledger entry?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    load();
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("Importing…");
    const text = await file.text();
    const res = await fetch("/api/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    const data = await res.json();
    if (res.ok) {
      setImportMsg(`Imported ${data.imported}, skipped ${data.skipped}.`);
      load();
    } else {
      setImportMsg(data.error ?? "Import failed");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const totals = txns.reduce(
    (acc, t) => {
      if (t.status !== "APPROVED") return acc;
      if (t.type === "DEPOSIT") acc.deposits += t.amount;
      else acc.withdrawals += t.amount;
      return acc;
    },
    { deposits: 0, withdrawals: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Filters + actions */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <Label htmlFor="filter-client">Client</Label>
            <Select
              id="filter-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.accountNumber}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to || clientId !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setClientId("all");
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </Button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/transactions/export?${query()}`}>
                <Download className="h-4 w-4" /> Export CSV
              </a>
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> Import CSV
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={onImport}
                />
                <AddTransactionDialog clients={clients} onCreated={load} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {importMsg && (
        <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
          {importMsg}
        </p>
      )}

      {/* Summary of the filtered set */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-profit/15 text-profit">
            <ArrowDownToLine className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Deposits</p>
            <p className="tnum text-lg font-semibold text-profit">{formatUsd(totals.deposits)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-loss/15 text-loss">
            <ArrowUpFromLine className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Withdrawals</p>
            <p className="tnum text-lg font-semibold text-loss">{formatUsd(totals.withdrawals)}</p>
          </div>
        </Card>
        <Card className="col-span-2 flex items-center gap-3 p-4 sm:col-span-1">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Net flow</p>
            <p className="tnum text-lg font-semibold">
              {formatUsd(totals.deposits - totals.withdrawals)}
            </p>
            <p className="text-xs text-muted-foreground">{txns.length} entries</p>
          </div>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : txns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="py-10 text-center text-muted-foreground">
                  No transactions match these filters.
                </TableCell>
              </TableRow>
            ) : (
              txns.map((t) => (
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
                  <TableCell>
                    <Badge variant={t.status === "APPROVED" ? "outline" : "warning"}>
                      {t.status === "APPROVED" ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                    {t.notes}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {t.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Approve"
                            onClick={() => approve(t.id)}
                          >
                            <Check className="h-4 w-4 text-profit" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => remove(t.id)}
                        >
                          <Trash2 className="h-4 w-4 text-loss" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
