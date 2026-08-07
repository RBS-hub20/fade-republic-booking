import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Trophy } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { DashboardView, type DashboardDataset } from "@/components/dashboard/dashboard-view";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { getAdminDashboardData, getClientPerformance } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/utils";
import { getReferralSummary, getLatestMonthlyBonus, getNetworkSalesForMonth } from "@/lib/referrals";
import { REFERRALS_ENABLED } from "@/lib/referrals-config";
import { tierForBalance } from "@/lib/tiers";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { MonthlyBonusCelebration } from "@/components/celebration/monthly-bonus-celebration";
import { ShanghaiPromo } from "@/components/celebration/shanghai-promo";
import { getBoolFlags, FLAG_BONUS_MODAL, FLAG_SHANGHAI_MODAL } from "@/lib/settings";
import { getCapitalSummary } from "@/lib/capital";
import { getPayoutState, syncPayoutTracking, type PayoutState } from "@/lib/payout-cap";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";
import { ReferralLinkCard } from "@/components/referrals/referral-link-card";
import { ReferralHistory } from "@/components/referrals/referral-history";
import { FinancePanel } from "@/components/finance/finance-panel";

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
    // Narrowed by the guard above; capture as a local so the type survives into
    // the nested async block below (control-flow narrowing doesn't cross closures).
    const clientId = session.clientId;

    // Fetch the signed-in user ONCE (needed by both the referral panel and the
    // "claim your @username" banner — previously two separate round trips).
    const me = session.userId
      ? await prisma.user
          .findUnique({
            where: { id: session.userId },
            select: {
              id: true,
              name: true,
              referralCode: true,
              commissionBalance: true,
              clientId: true,
              usernameSet: true,
              activationType: true,
              exclusivePackage: true,
            },
          })
          .catch(() => null)
      : null;

    // Load the four INDEPENDENT sections concurrently instead of serially — this
    // is the client-side "lean" win: ~25 sequential round trips collapse to one
    // wave (bounded by the slowest block, not their sum), given connection_limit
    // > 1. Each block self-guards and falls back to its prior default, so the
    // dashboard still renders fully if any piece is unavailable — behavior is
    // unchanged, only the concurrency differs.
    const [perf, referral, capitalBundle, payout, celebrationBonus, networkSales, flags] = await Promise.all([
      getClientPerformance(session.clientId).catch((err) => {
        console.error("[dashboard] performance unavailable:", err);
        return null;
      }),
      REFERRALS_ENABLED && me
        ? getReferralSummary(me).catch((err) => {
            console.error("[dashboard] referral summary unavailable:", err);
            return null;
          })
        : Promise.resolve(null),
      (async (): Promise<{
        capital: Awaited<ReturnType<typeof getCapitalSummary>> | null;
        withdrawals: any[];
      }> => {
        if (!session.userId) return { capital: null, withdrawals: [] };
        try {
          await ensureFinanceSchemaOnce(prisma);
          const capital = await getCapitalSummary({ clientId, userId: session.userId });
          const withdrawals = await prisma.withdrawal.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: "desc" },
            take: 25,
          });
          return { capital, withdrawals };
        } catch (err) {
          console.error("[dashboard] capital summary unavailable:", err);
          return { capital: null, withdrawals: [] };
        }
      })(),
      session.userId && session.clientId
        ? getPayoutState(session.userId, session.clientId).catch(() => null as PayoutState | null)
        : Promise.resolve(null as PayoutState | null),
      session.userId ? getLatestMonthlyBonus(session.userId).catch(() => null) : Promise.resolve(null),
      session.userId ? getNetworkSalesForMonth(session.userId, "2026-08").catch(() => 0) : Promise.resolve(0),
      getBoolFlags([FLAG_BONUS_MODAL, FLAG_SHANGHAI_MODAL]).catch(() => ({ [FLAG_BONUS_MODAL]: true, [FLAG_SHANGHAI_MODAL]: true })),
    ]);

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
    const capital = capitalBundle.capital;
    const withdrawals = capitalBundle.withdrawals;
    const k = perf?.kpis;

    // INACTIVE account: funded before but all locked capital has since been
    // withdrawn (remaining principal = $0). Such accounts earn no daily ROI and
    // no referral commissions until they fund a new package (min Bronze $50).
    const remainingPrincipal = capital ? capital.activeCapital + capital.maturedCapital : null;
    const isInactive =
      remainingPrincipal !== null && remainingPrincipal <= 0 && (k?.totalDeposits ?? 0) > 0;

    // Sync the 5x payout-cap tracking cache in the background (unchanged;
    // fire-and-forget, never blocks the render).
    if (payout && session.userId) void syncPayoutTracking(session.userId, payout);
    // NETWORK_ONLY accounts can't lift the cap by adding capital, so the
    // "add capital to continue" nudge doesn't apply to them.
    const showCapWarning =
      payout != null &&
      !payout.capped &&
      payout.status === "ACTIVE" &&
      payout.pct >= 80 &&
      me?.activationType !== "NETWORK_ONLY";

    const showUsernameBanner = me ? !me.usernameSet : false;

    return (
      <>
        <MonthlyBonusCelebration
          bonus={celebrationBonus}
          firstName={session.name.split(" ")[0]}
          referralCode={me?.referralCode ?? null}
          tier={tierForBalance(perf?.kpis.currentBalance ?? 0)?.name ?? "Starter"}
          origin={process.env.NEXT_PUBLIC_SITE_URL || "https://quantumxglobal.online"}
          enabled={flags[FLAG_BONUS_MODAL]}
        />
        <ShanghaiPromo
          networkSales={networkSales}
          referralCode={me?.referralCode ?? null}
          origin={process.env.NEXT_PUBLIC_SITE_URL || "https://quantumxglobal.online"}
          enabled={flags[FLAG_SHANGHAI_MODAL]}
        />
        <PageHeader
          title={`Welcome, ${session.name.split(" ")[0]}`}
          subtitle="Your account performance · calculated daily, Mon–Sun (Asia/Manila)"
        />
        <InstallAppButton />
        {me?.activationType === "NETWORK_ONLY" &&
          (payout?.capped ? (
            // EXCLUSIVE capping — no unlock — no real capital — cap cannot be lifted.
            <div className="mb-6 rounded-xl border border-loss/50 bg-loss/10 px-4 py-3.5">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-loss">
                🔴 CAPPED — No Unlock — No Real Capital
              </p>
              <p className="mt-1.5 text-xs text-loss/90">
                Max earnings reached ({formatUsd(payout.totalEarnedAll)} / {formatUsd(payout.maxPayoutCap)}).
                Your package cap can&apos;t be unlocked. Contact admin if you want to convert to a STANDARD
                account with a real deposit.
              </p>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-gold-400/50 bg-gradient-to-r from-gold-400/15 to-transparent px-4 py-3.5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-gold-200">
                <Trophy className="h-4 w-4 text-gold-400" />
                EXCLUSIVE {(me.exclusivePackage ?? "").toUpperCase() || "MEMBER"} — No Daily %
              </p>
              <p className="mt-1.5 text-xs text-gold-100/80">
                Active Earnings: Direct Referral ✓ · Indirect Referral ✓ · Monthly Bonus ✓ · 2nd-Level Unlock ✓
                <span className="ml-1 font-semibold text-gold-300">— Daily 0%</span>
                {payout && payout.maxPayoutCap > 0 && (
                  <span className="ml-1 text-gold-100/70">
                    · Cap {formatUsd(payout.totalEarnedAll)}/{formatUsd(payout.maxPayoutCap)} ({payout.pct}%)
                  </span>
                )}
              </p>
            </div>
          ))}
        {flags[FLAG_SHANGHAI_MODAL] && (
          <Link
            href="/dashboard/leaderboard"
            className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-gold-400/40 bg-gradient-to-r from-gold-400/15 to-transparent px-4 py-3 text-sm text-gold-200 transition-colors hover:bg-gold-400/20"
          >
            <span className="font-medium">🏆 Shanghai Race — Top 20 network sales live this month</span>
            <span className="shrink-0 font-semibold text-gold-300">View Leaderboard →</span>
          </Link>
        )}
        {isInactive && (
          <Link
            href="/qx-tiers"
            className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss transition-colors hover:bg-loss/20"
          >
            <span className="font-medium">
              🔴 INACTIVE — Purchase a minimum $50 package to reactivate. No daily ROI or referral
              commissions while inactive.
            </span>
            <span className="shrink-0 font-semibold">Reactivate →</span>
          </Link>
        )}
        {showCapWarning && payout && (
          <div className="mb-6 flex flex-col gap-2 rounded-lg border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm text-gold-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium">
              ⚠️ You&apos;re at {payout.pct}% of your Max Payout Cap. Renew or add capital to continue
              earning.
            </span>
            <Link href="/qx-tiers" className="shrink-0 font-semibold text-gold-300 hover:text-gold-200">
              Add capital →
            </Link>
          </div>
        )}
        {showUsernameBanner && (
          <Link
            href="/settings/username"
            className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-200 transition-colors hover:bg-gold-400/20"
          >
            <span>🎉 Claim your @username — you can set it once!</span>
            <span className="shrink-0 font-semibold text-gold-300">Set username →</span>
          </Link>
        )}
        {referral && <div className="mb-6"><ReferralLinkCard summary={referral} /></div>}

        {capital && k ? (
          <div className="mb-6">
            <FinancePanel
              capital={{
                activeCapital: capital.activeCapital,
                maturedCapital: capital.maturedCapital,
                hasMatured: capital.hasMatured,
                daysToMaturity: capital.daysToMaturity,
                earliestMaturity: capital.earliestMaturity,
                maturedDepositIds: capital.deposits.filter((d) => d.matured).map((d) => d.id),
                availableWithdrawal: capital.availableWithdrawal,
                totalEarned: capital.totalEarned,
                totalWithdrawn: capital.totalWithdrawn,
                commissionsEarned: capital.commissionsEarned,
                coolingCapital: capital.coolingCapital,
                nextProfitAt: capital.nextProfitAt,
              }}
              kpis={{
                winRate: k.winRate,
                avgDailyPercent: k.avgDailyPercent,
                totalNetPnl: k.totalNetPnl,
              }}
              withdrawals={withdrawals.map((w) => ({
                id: w.id,
                amount: w.amount,
                fee: w.fee,
                receiveAmount: w.receiveAmount,
                network: w.network,
                status: w.status,
                txHash: w.txHash,
                rejectReason: w.rejectReason,
                createdAt: w.createdAt.toISOString(),
              }))}
              payout={payout}
              clientId={session.clientId}
            />
          </div>
        ) : null}

        {/* Equity curve + daily performance log (KPI grid handled by FinancePanel) */}
        <DashboardView datasets={datasets} showSelector={false} showKpis={!capital} />

        {referral && (
          <div className="mt-6">
            <ReferralHistory
              history={referral.history}
              commissionBalance={referral.commissionBalance}
              showWithdraw={false}
            />
          </div>
        )}
        {/* XENA AI support now floats globally from the root layout. */}
      </>
    );
  }

  // --- Admin view: portfolio + every client (monitoring) -------------------
  // Single bulk read computes the portfolio aggregate AND every client's curve
  // (replaces getPortfolioPerformance + an N+1 getClientPerformance per client).
  const admin = await getAdminDashboardData();
  const portfolio = admin.portfolio;

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
    ...admin.clients.map((c) => ({
      id: c.id,
      label: `${c.name} · ${c.accountNumber}`,
      curve: c.curve,
      kpis: c.kpis,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Performance Dashboard"
        subtitle="Admin monitoring · PAMM-style compounded equity across all clients (Asia/Manila)"
      />
      <InstallAppButton />

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
