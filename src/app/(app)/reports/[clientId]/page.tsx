import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/reports/report-view";
import { getClientPerformance } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { toManilaDateKey } from "@/lib/performance";
import type { ReportTxn } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: { clientId: string };
}) {
  const session = getSession();
  const perf = await getClientPerformance(params.clientId);
  if (!perf || !perf.client) notFound();

  const { client, curve, kpis } = perf;

  const transactions: ReportTxn[] = client.transactions.map((t) => ({
    date: toManilaDateKey(t.date),
    type: t.type,
    amount: t.amount,
    method: t.method,
    status: t.status,
    notes: t.notes,
  }));

  return (
    <>
      <PageHeader title="Client Statement" subtitle={client.accountNumber}>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports">
            <ArrowLeft className="h-4 w-4" /> All reports
          </Link>
        </Button>
      </PageHeader>

      <ReportView
        client={{
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          accountNumber: client.accountNumber,
          startDate: client.startDate.toISOString(),
          initialDeposit: client.initialDeposit,
        }}
        kpis={kpis}
        curve={curve}
        transactions={transactions}
        isAdmin={session?.role === "admin"}
      />
    </>
  );
}
