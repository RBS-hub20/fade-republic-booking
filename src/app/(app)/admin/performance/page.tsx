import { redirect } from "next/navigation";
import { TrendingUp, Wallet, Percent, PiggyBank, Landmark } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth";
import { getServerPerformanceSummary, type PeriodTotals } from "@/lib/server-performance";
import { getDailyPerfHealth } from "@/lib/daily-performance";
import { PerfHealthBanner } from "@/components/admin/perf-health-banner";
import { formatUsd, formatPct, formatDateKey, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPerformancePage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const perf = await getServerPerformanceSummary();
  const t = perf.today;
  const perfHealth = await getDailyPerfHealth().catch(() => null);

  // Platform revenue from withdrawal fees (best-effort — table may be new).
  let feeRevenue = 0;
  try {
    const agg = await prisma.withdrawal.aggregate({
      where: { status: "completed" },
      _sum: { fee: true },
    });
    feeRevenue = agg._sum.fee ?? 0;
  } catch {
    feeRevenue = 0;
  }

  return (
    <>
      <PageHeader
        title="Fund Performance"
        subtitle="Internal server gross (1–2%/day) vs. client payout (0.3–0.5%/day) — actual vs. paid out (Asia/Manila)."
      />

      {perfHealth && (
        <PerfHealthBanner
          health={{
            ok: perfHealth.ok,
            lastPostedKey: perfHealth.lastPostedKey,
            yesterdayKey: perfHealth.yesterdayKey,
            stale: perfHealth.stale,
            daysBehind: perfHealth.daysBehind,
            clientsBehind: perfHealth.clientsBehind,
          }}
        />
      )}

      <div className="mb-8">
        <KpiCard
          label="Platform Revenue (Withdrawal Fees)"
          value={formatUsd(feeRevenue)}
          sub="3% fee on completed withdrawals"
          icon={Landmark}
          tone="gold"
        />
      </div>

      {/* Today */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Today {t ? `· ${formatDateKey(t.date)}` : ""}
      </h2>
      {t ? (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Server Gross %"
            value={formatPct(t.avgServerPct)}
            sub={`${formatUsd(t.grossUsd)} gross`}
            icon={TrendingUp}
            tone="profit"
          />
          <KpiCard
            label="Client Payout %"
            value={formatPct(t.avgClientPct)}
            sub={`${formatUsd(t.payoutUsd)} paid out`}
            icon={Wallet}
            tone="gold"
          />
          <KpiCard
            label="Daily Profit Margin"
            value={formatUsd(t.marginUsd)}
            sub={`${t.clients} client${t.clients === 1 ? "" : "s"} credited`}
            icon={PiggyBank}
            tone="profit"
          />
          <KpiCard
            label="Margin %"
            value={formatPct(t.grossUsd > 0 ? (t.marginUsd / t.grossUsd) * 100 : 0)}
            sub="kept vs. gross"
            icon={Percent}
            tone="neutral"
          />
        </div>
      ) : (
        <Card className="mb-8">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No performance recorded for today yet. Run{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">/api/cron/daily</code> (or
            wait for the 23:59 PHT cron).
          </CardContent>
        </Card>
      )}

      {/* Period totals */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PeriodCard title="Last 7 Days" totals={perf.last7} />
        <PeriodCard title="Last 30 Days" totals={perf.last30} />
      </div>

      {/* Daily breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                  <TableHead className="text-right">Server %</TableHead>
                  <TableHead className="text-right">Client %</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perf.days.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No performance data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  perf.days.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatDateKey(d.date)}
                      </TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">
                        {d.clients}
                      </TableCell>
                      <TableCell className="tnum text-right text-profit">
                        {d.avgServerPct ? formatPct(d.avgServerPct) : "—"}
                      </TableCell>
                      <TableCell className="tnum text-right text-gold-300">
                        {formatPct(d.avgClientPct)}
                      </TableCell>
                      <TableCell className="tnum text-right">{formatUsd(d.grossUsd)}</TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">
                        {formatUsd(d.payoutUsd)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tnum text-right font-semibold",
                          d.marginUsd >= 0 ? "text-profit" : "text-loss"
                        )}
                      >
                        {formatUsd(d.marginUsd)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function PeriodCard({ title, totals }: { title: string; totals: PeriodTotals }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title}{" "}
          <span className="text-sm font-normal text-muted-foreground">· {totals.days} days</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Gross" value={formatUsd(totals.grossUsd)} sub={formatPct(totals.avgServerPct)} tone="profit" />
          <Stat label="Payout" value={formatUsd(totals.payoutUsd)} sub={formatPct(totals.avgClientPct)} tone="gold" />
          <Stat label="Margin" value={formatUsd(totals.marginUsd)} sub={formatPct(totals.marginPct)} tone="profit" />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "profit" | "gold";
}) {
  const color = tone === "gold" ? "text-gold-300" : "text-profit";
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tnum mt-1 text-lg font-bold", color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub} avg</p>
    </div>
  );
}
