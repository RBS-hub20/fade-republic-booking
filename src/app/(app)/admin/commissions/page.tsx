import { redirect } from "next/navigation";
import { Users2, Network, CalendarClock, Wallet, Landmark, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { getSession } from "@/lib/auth";
import {
  resolveUsers, getDirectCommissions, getIndirectCommissions, getMonthlyBonuses,
  getCompensationSummary, getDownlineLedger,
  type DirectRow, type IndirectRow, type BonusRow, type CompensationSummary, type DownlineLedgerRow,
} from "@/lib/admin-referrals";
import { CommissionsTabs } from "@/components/admin/commissions-tabs";
import { formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCommissionsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  let direct: DirectRow[] = [], indirect: IndirectRow[] = [], bonus: BonusRow[] = [];
  let ledger: DownlineLedgerRow[] = [];
  let comp: CompensationSummary = { l1: 0, l2: 0, bonus: 0, grandTotal: 0, feeRevenue: 0, net: 0 };
  try {
    const users = await resolveUsers();
    [direct, indirect, bonus, ledger, comp] = await Promise.all([
      getDirectCommissions(users),
      getIndirectCommissions(users),
      getMonthlyBonuses(users),
      getDownlineLedger(users),
      getCompensationSummary(),
    ]);
  } catch (err) {
    console.error("[admin/commissions] error:", err);
  }

  return (
    <>
      <PageHeader
        title="Commissions"
        subtitle="Multi-level compensation — direct (1st), indirect (2nd), and monthly bonus payouts."
      />

      {/* Compensation-plan KPI header */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Paid · L1 Direct" value={formatUsd(comp.l1)} icon={Users2} tone="gold" />
        <KpiCard label="Total Paid · L2 Indirect" value={formatUsd(comp.l2)} icon={Network} tone="gold" />
        <KpiCard label="Total Paid · Monthly Bonus" value={formatUsd(comp.bonus)} icon={CalendarClock} tone="gold" />
        <KpiCard label="Grand Total Payout" value={formatUsd(comp.grandTotal)} icon={Wallet} tone="loss" />
        <KpiCard label="Platform Fee Revenue" value={formatUsd(comp.feeRevenue)} icon={Landmark} tone="profit" />
        <KpiCard
          label="Net Revenue"
          value={formatUsd(comp.net)}
          sub="Fees − payouts"
          icon={TrendingUp}
          tone={comp.net >= 0 ? "profit" : "loss"}
        />
      </div>

      <CommissionsTabs direct={direct} indirect={indirect} bonus={bonus} ledger={ledger} />
    </>
  );
}
