import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/reports/report-view";
import { getClientPerformance } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCapitalSummary, addMonths, LOCK_MONTHS } from "@/lib/capital";
import { toManilaDateKey } from "@/lib/performance";
import type { ReportTxn } from "@/lib/pdf";
import {
  tierForPackageAmount,
  packageEmoji,
  packageProgress,
  type PackageRow,
} from "@/lib/packages";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: { clientId: string };
}) {
  const session = getSession();
  if (!session) redirect("/login");
  const isAdmin = session.role === "admin";
  // Clients may only view their own statement.
  if (!isAdmin && session.clientId !== params.clientId) redirect("/dashboard");

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

  // Active Packages: locked-capital deposits with 6-month unlock windows.
  // Reuses the capital money-model so unlock dates match the wallet exactly.
  // Best-effort — a failure here must never break the rest of the statement.
  const owner = await prisma.user
    .findFirst({ where: { clientId: params.clientId }, select: { id: true } })
    .catch(() => null);
  const capital = await getCapitalSummary({
    clientId: params.clientId,
    userId: owner?.id ?? session.userId ?? "",
  }).catch(() => null);
  const packages: PackageRow[] = (capital?.deposits ?? []).map((d) => {
    const tier = tierForPackageAmount(d.amount);
    return {
      id: d.id,
      tierId: tier?.id ?? null,
      label: tier ? tier.name.toUpperCase() : "PACKAGE",
      emoji: packageEmoji(tier?.id ?? null),
      amount: d.amount,
      purchaseDate: d.depositedAt,
      unlockDate: d.maturityDate,
      // Renewing starts a fresh 6-month lock from now (today + 6 months).
      renewUnlockDate: addMonths(new Date(), LOCK_MONTHS).toISOString(),
      locked: !d.matured,
      daysLeft: d.daysToMaturity,
      progressPct: packageProgress(d.daysToMaturity),
    };
  });

  return (
    <>
      <PageHeader
        title={isAdmin ? "Client Statement" : "My Statement"}
        subtitle={client.accountNumber}
      >
        {isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link href="/reports">
              <ArrowLeft className="h-4 w-4" /> All reports
            </Link>
          </Button>
        )}
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
        packages={packages}
        canWithdraw={!isAdmin}
        isAdmin={isAdmin}
      />
    </>
  );
}
