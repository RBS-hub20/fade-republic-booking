"use client";

import { useMemo, useState } from "react";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Target,
  Percent,
  DollarSign,
} from "lucide-react";
import { KpiCard } from "./kpi-card";
import { EquityChart } from "./equity-chart";
import { DailyPerformanceTable } from "./daily-performance-table";
import { Select } from "@/components/ui/select";
import { cn, formatUsd, formatPct } from "@/lib/utils";
import type { EquityPoint, PerformanceKpis } from "@/lib/performance";

export interface DashboardDataset {
  id: string;
  label: string;
  curve: EquityPoint[];
  kpis: PerformanceKpis;
}

export function DashboardView({
  datasets,
  showSelector = true,
  referralEarnings = null,
}: {
  datasets: DashboardDataset[];
  showSelector?: boolean;
  /** Lifetime referral commissions — adds a gold KPI card when provided. */
  referralEarnings?: number | null;
}) {
  const [selected, setSelected] = useState(datasets[0]?.id ?? "");
  const active = useMemo(
    () => datasets.find((d) => d.id === selected) ?? datasets[0],
    [datasets, selected]
  );

  if (!active) {
    return (
      <p className="text-sm text-muted-foreground">
        No clients yet. Add a client to see performance.
      </p>
    );
  }

  const k = active.kpis;
  const pnlTone = k.totalNetPnl >= 0 ? "profit" : "loss";

  return (
    <div className="space-y-6">
      {showSelector && datasets.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Viewing performance for</p>
          <div className="w-64">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div
        className={cn(
          "grid grid-cols-2 gap-4 lg:grid-cols-3",
          referralEarnings != null ? "xl:grid-cols-4 2xl:grid-cols-7" : "xl:grid-cols-6"
        )}
      >
        <KpiCard
          label="Current Balance"
          value={formatUsd(k.currentBalance)}
          icon={Wallet}
          tone="gold"
        />
        <KpiCard
          label="Total Deposits"
          value={formatUsd(k.totalDeposits)}
          icon={ArrowDownToLine}
        />
        <KpiCard
          label="Total Withdrawals"
          value={formatUsd(k.totalWithdrawals)}
          icon={ArrowUpFromLine}
        />
        <KpiCard
          label="Net P/L"
          value={formatUsd(k.totalNetPnl)}
          sub={`over ${k.tradingDays} trading days`}
          icon={TrendingUp}
          tone={pnlTone}
        />
        <KpiCard
          label="Win Rate"
          value={formatPct(k.winRate, 1)}
          icon={Target}
          tone="profit"
        />
        <KpiCard
          label="Avg Daily %"
          value={formatPct(k.avgDailyPercent)}
          icon={Percent}
          tone="gold"
        />
        {referralEarnings != null && (
          <KpiCard
            label="Referral Earnings"
            value={formatUsd(referralEarnings)}
            sub="Lifetime commissions"
            icon={DollarSign}
            tone="gold"
          />
        )}
      </div>

      <EquityChart curve={active.curve} />

      <DailyPerformanceTable curve={active.curve} />
    </div>
  );
}
