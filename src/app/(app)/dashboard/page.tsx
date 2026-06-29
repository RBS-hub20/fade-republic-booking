import { PageHeader } from "@/components/shell/page-header";
import { DashboardView, type DashboardDataset } from "@/components/dashboard/dashboard-view";
import { getPortfolioPerformance, getClientPerformance } from "@/lib/data";
import { prisma } from "@/lib/prisma";

// Always fetch fresh — balances change as the ledger is edited.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
        subtitle="PAMM-style compounded equity reporting · 0.3%–0.6% est. daily, Mon–Fri (Asia/Manila)"
      />
      <DashboardView datasets={datasets} />
    </>
  );
}
