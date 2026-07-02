import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { DashboardView, type DashboardDataset } from "@/components/dashboard/dashboard-view";
import { getPortfolioPerformance, getClientPerformance } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Always fetch fresh — balances change as the ledger is edited.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = getSession();
  if (!session) redirect("/login");

  // --- Client view: only their own account ---------------------------------
  if (session.role === "client") {
    if (!session.clientId) {
      return (
        <>
          <PageHeader title="Dashboard" subtitle="Welcome to QuantumX Global Markets" />
          <p className="text-sm text-muted-foreground">
            No trading account is linked to your profile yet. Please contact support.
          </p>
        </>
      );
    }
    const perf = await getClientPerformance(session.clientId);
    const datasets: DashboardDataset[] = perf
      ? [
          {
            id: perf.client!.id,
            label: `${perf.client!.name} · ${perf.client!.accountNumber}`,
            curve: perf.curve,
            kpis: perf.kpis,
          },
        ]
      : [];
    return (
      <>
        <PageHeader
          title={`Welcome, ${session.name.split(" ")[0]}`}
          subtitle="Your account performance · compounded daily, Mon–Fri (Asia/Manila)"
        />
        <DashboardView datasets={datasets} showSelector={false} />
      </>
    );
  }

  // --- Admin view: portfolio + every client (monitoring) -------------------
  const portfolio = await getPortfolioPerformance();
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "asc" } });

  const datasets: DashboardDataset[] = [
    {
      id: "portfolio",
      label: `📊 All Clients (Portfolio · ${portfolio.clientCount})`,
      curve: portfolio.curve,
      kpis: portfolio.kpis,
    },
  ];

  for (const c of clients) {
    const perf = await getClientPerformance(c.id);
    if (perf) {
      datasets.push({
        id: c.id,
        label: `${c.name} · ${c.accountNumber}`,
        curve: perf.curve,
        kpis: perf.kpis,
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Performance Dashboard"
        subtitle="Admin monitoring · PAMM-style compounded equity across all clients (Asia/Manila)"
      />
      <DashboardView datasets={datasets} />
    </>
  );
}
