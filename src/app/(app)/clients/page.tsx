import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { AddClientDialog } from "@/components/clients/add-client-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { redirect } from "next/navigation";
import { getClientsWithBalance } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";
import { getCapitalSummary, type CapitalSummary } from "@/lib/capital";
import { cn, formatUsd, formatDate } from "@/lib/utils";
import { STATUS_LABELS, type ClientStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

const statusVariant: Record<ClientStatus, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  CLOSED: "danger",
};

export default async function ClientsPage() {
  const session = getSession();
  if (session?.role !== "admin") redirect("/dashboard");
  const clients = await getClientsWithBalance();

  // Per-client capital-lock figures (Active Capital / Available / Maturity).
  const capitalByClient = new Map<string, CapitalSummary>();
  try {
    await ensureFinanceSchemaOnce(prisma);
    const users = await prisma.user.findMany({
      where: { clientId: { in: clients.map((c) => c.id) } },
      select: { id: true, clientId: true },
    });
    const userByClient = new Map(users.map((u) => [u.clientId as string, u.id]));
    await Promise.all(
      clients.map(async (c) => {
        const summary = await getCapitalSummary({
          clientId: c.id,
          userId: userByClient.get(c.id) ?? "",
        }).catch(() => null);
        if (summary) capitalByClient.set(c.id, summary);
      })
    );
  } catch (err) {
    console.error("[clients] capital summaries unavailable:", err);
  }

  return (
    <>
      <PageHeader title="Clients" subtitle={`${clients.length} managed accounts`}>
        <AddClientDialog />
      </PageHeader>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Active Capital</TableHead>
              <TableHead className="text-right">Available Withdrawal</TableHead>
              <TableHead>Maturity Date</TableHead>
              <TableHead className="text-right">Net P/L</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => {
              const cap = capitalByClient.get(c.id);
              const activeCapital = cap ? cap.activeCapital + cap.maturedCapital : c.initialDeposit;
              return (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{c.accountNumber}</TableCell>
                <TableCell className="text-right">
                  <div className="tnum font-medium text-gold-300">{formatUsd(activeCapital)}</div>
                  {activeCapital > 0 && (
                    <Badge variant="warning" className="mt-0.5">
                      {cap?.hasMatured ? "Matured" : "Locked"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="tnum font-medium text-profit">
                    {formatUsd(cap?.availableWithdrawal ?? 0)}
                  </div>
                  <Badge variant="success" className="mt-0.5">Withdrawable</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {cap?.earliestMaturity ? (
                    <>
                      <div className="text-sm">{formatDate(cap.earliestMaturity)}</div>
                      <div className="text-xs text-muted-foreground">
                        {cap.daysToMaturity != null
                          ? `Unlocks in ${cap.daysToMaturity} day${cap.daysToMaturity === 1 ? "" : "s"}`
                          : ""}
                      </div>
                    </>
                  ) : cap?.hasMatured ? (
                    <span className="text-xs font-medium text-profit">Matured</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "tnum text-right",
                    c.totalNetPnl >= 0 ? "text-profit" : "text-loss"
                  )}
                >
                  {c.totalNetPnl >= 0 ? "+" : ""}
                  {formatUsd(c.totalNetPnl)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status as ClientStatus]}>
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
              );
            })}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No clients yet. Click “Add Client” to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
