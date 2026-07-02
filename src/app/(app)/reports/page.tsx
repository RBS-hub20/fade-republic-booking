import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { getClientsWithBalance } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { formatUsd } from "@/lib/utils";
import { STATUS_LABELS, type ClientStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ReportsIndexPage() {
  const session = getSession();
  if (!session) redirect("/login");
  // Clients have a single statement (their own); send them straight to it.
  if (session.role === "client") {
    redirect(session.clientId ? `/reports/${session.clientId}` : "/dashboard");
  }
  const clients = await getClientsWithBalance();

  return (
    <>
      <PageHeader
        title="Client Reports"
        subtitle="Select a client to view their statement and export a monthly PDF report."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => (
          <Link key={c.id} href={`/reports/${c.id}`}>
            <Card className="flex items-center justify-between p-4 transition-colors hover:border-gold-400/50 hover:bg-accent/40">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold-400/15 text-gold-300">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{c.accountNumber}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="tnum text-sm font-semibold text-gold-300">
                  {formatUsd(c.currentBalance)}
                </p>
                <Badge variant="outline" className="mt-1">
                  {STATUS_LABELS[c.status as ClientStatus] ?? c.status}
                </Badge>
              </div>
              <ChevronRight className="ml-2 h-4 w-4 text-muted-foreground" />
            </Card>
          </Link>
        ))}
        {clients.length === 0 && (
          <p className="text-sm text-muted-foreground">No clients to report on yet.</p>
        )}
      </div>
    </>
  );
}
