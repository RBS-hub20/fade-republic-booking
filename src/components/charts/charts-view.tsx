"use client";

import { TradingViewChart } from "./tradingview-chart";
import { Watchlist } from "./watchlist";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useChartStore, SYMBOLS, TIMEFRAMES } from "@/lib/store";

export function ChartsView() {
  const { symbol, interval, setSymbol, setInterval } = useChartStore();
  const activeSymbol = SYMBOLS.find((s) => s.value === symbol) ?? SYMBOLS[0];

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-3">
        {/* Symbol switcher + timeframe controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {SYMBOLS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSymbol(s.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  symbol === s.value
                    ? s.gold
                      ? "border-gold-400 bg-gold-400 text-black"
                      : "border-gold-400/60 bg-gold-400/15 text-gold-300"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-1 rounded-md border border-border p-0.5">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setInterval(t.value)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  interval === t.value
                    ? "bg-gold-400 text-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  activeSymbol.gold ? "bg-gold-400" : "bg-profit"
                )}
              />
              <span className="font-semibold">{activeSymbol.label}</span>
              <span className="text-xs text-muted-foreground">{activeSymbol.short}</span>
            </div>
            <span className="text-xs text-muted-foreground">Live · TradingView</span>
          </div>
          {/* Full-screen-ish chart area */}
          <div className="h-[calc(100vh-22rem)] min-h-[420px] w-full">
            <TradingViewChart symbol={symbol} interval={interval} />
          </div>
        </Card>
      </div>

      {/* Right sidebar watchlist */}
      <div className="w-full xl:w-80">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-2">
            <span className="text-sm font-semibold">Watchlist</span>
            <span className="ml-2 text-xs text-muted-foreground">% change</span>
          </div>
          <div className="h-[420px] xl:h-[calc(100vh-19rem)]">
            <Watchlist />
          </div>
        </Card>
      </div>
    </div>
  );
}
