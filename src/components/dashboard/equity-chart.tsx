"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatUsd, formatDateKey } from "@/lib/utils";
import {
  filterCurveByRange,
  type EquityPoint,
  type EquityRange,
} from "@/lib/performance";

const RANGES: EquityRange[] = ["1W", "1M", "3M", "YTD", "ALL"];
const RANGE_LABELS: Record<EquityRange, string> = {
  "1W": "1W",
  "1M": "1M",
  "3M": "3M",
  YTD: "YTD",
  ALL: "All",
};

interface ChartRow {
  date: string;
  balance: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartRow;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{formatDateKey(row.date)}</p>
      <p className="tnum mt-0.5 font-semibold text-gold-300">{formatUsd(row.balance)}</p>
    </div>
  );
}

export function EquityChart({
  curve,
  title = "Equity Curve",
}: {
  curve: EquityPoint[];
  title?: string;
}) {
  const [range, setRange] = useState<EquityRange>("1M");

  const data: ChartRow[] = useMemo(
    () =>
      filterCurveByRange(curve, range).map((p) => ({
        date: p.date,
        balance: Math.round(p.balance * 100) / 100,
      })),
    [curve, range]
  );

  const first = data[0]?.balance ?? 0;
  const last = data[data.length - 1]?.balance ?? 0;
  const change = last - first;
  const changePct = first ? (change / first) * 100 : 0;
  const up = change >= 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tnum text-2xl font-bold">{formatUsd(last)}</span>
            <span className={cn("tnum text-sm font-medium", up ? "text-profit" : "text-loss")}>
              {up ? "▲" : "▼"} {formatUsd(Math.abs(change))} ({changePct.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-gold-400 text-black"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No performance data for this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e0b54a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e0b54a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 14% 16%)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) =>
                    new Date(`${v}T12:00:00Z`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })
                  }
                  tick={{ fill: "hsl(215 14% 58%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tickFormatter={(v: number) => formatUsd(v, { compact: true })}
                  tick={{ fill: "hsl(215 14% 58%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#e0b54a"
                  strokeWidth={2}
                  fill="url(#equityFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
