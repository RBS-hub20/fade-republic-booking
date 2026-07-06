import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { DashboardView, type DashboardDataset } from "@/components/dashboard/dashboard-view";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { getPortfolioPerformance, getClientPerformance } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/utils";
import { getReferralSummary } from "@/lib/referrals";
import { ReferralLinkCard } from "@/components/referrals/referral-link-card";
import { ReferralHistory } from "@/components/referrals/referral-history";

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

    // Referral program data for this user.
    const me = session.userId
      ? await prisma.user.findUnique({
          where: { id: session.userId },
          select: { id: true, name: true, referralCode: true, commissionBalance: true, clientId: true },
        })
      : null;
    const referral = me ? await getReferralSummary(me) : null;

    return (
      <>
        <PageHeader
          title={`Welcome, ${session.name.split(" ")[0]}`}
          subtitle="Your account performance · compounded daily, Mon–Fri (Asia/Manila)"
        />
        {referral && <div className="mb-6"><ReferralLinkCard summary={referral} /></div>}
        <DashboardView
          datasets={datasets}
          showSelector={false}
          referralEarnings={referral?.totalEarned ?? 0}
        />
        {referral && (
          <div className="mt-6">
            <ReferralHistory
              history={referral.history}
              commissionBalance={referral.commissionBalance}
            />
          </div>
        )}
      </>
    );
  }

  // --- Admin view: portfolio + every client (monitoring) -------------------
  const portfolio = await getPortfolioPerformance();
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "asc" } });

  // Pending-request aggregates for the admin KPI cards.
  const pendingAgg = await prisma.transaction.groupBy({
    by: ["type"],
    where: { status: "PENDING" },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const dep = pendingAgg.find((p) => p.type === "DEPOSIT");
  const wit = pendingAgg.find((p) => p.type === "WITHDRAWAL");
  const pendingDeposits = { count: dep?._count._all ?? 0, volume: dep?._sum.amount ?? 0 };
  const pendingWithdrawals = { count: wit?._count._all ?? 0, volume: wit?._sum.amount ?? 0 };

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

      {/* Pending-request KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/approvals">
          <KpiCard
            label="Pending Deposits"
            value={formatUsd(pendingDeposits.volume)}
            sub={`${pendingDeposits.count} request${pendingDeposits.count === 1 ? "" : "s"} awaiting approval`}
            icon={ArrowDownToLine}
            tone="profit"
          />
        </Link>
        <Link href="/approvals">
          <KpiCard
            label="Pending Withdrawals"
            value={formatUsd(pendingWithdrawals.volume)}
            sub={`${pendingWithdrawals.count} request${pendingWithdrawals.count === 1 ? "" : "s"} awaiting approval`}
            icon={ArrowUpFromLine}
            tone="loss"
          />
        </Link>
      </div>

      <DashboardView datasets={datasets} />
    </>
  );
}
