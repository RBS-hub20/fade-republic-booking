"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Quote {
  symbol: string;
  name?: string;
  price: number;
  changePct: number;
  sparkline?: number[];
}
interface MarketData {
  updatedAt: string;
  stale: boolean;
  sections: { crypto: Quote[]; forex: Quote[]; stocks: Quote[]; metals: Quote[] };
}

const POLL_MS = 20_000;

function formatPrice(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const decimals = v >= 100 ? 2 : v >= 1 ? 4 : 5;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (!points || points.length < 2) return null;
  const w = 60;
  const h = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path d={d} fill="none" stroke={up ? "#16c784" : "#ea3943"} strokeWidth={1.5} />
    </svg>
  );
}

function QuoteCard({ q, showSpark }: { q: Quote; showSpark?: boolean }) {
  const up = q.changePct >= 0;
  return (
    <div className="w-[46vw] shrink-0 snap-start rounded-lg border border-border bg-card p-3 sm:w-auto sm:min-w-[148px] sm:snap-none sm:px-3 sm:py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{q.symbol}</span>
        {showSpark && q.sparkline && q.sparkline.length > 1 && (
          <Sparkline points={q.sparkline} up={up} />
        )}
      </div>
      <div className="tnum mt-1 text-lg font-bold sm:text-sm">
        <span className="text-muted-foreground">$</span>
        {formatPrice(q.price)}
      </div>
      <div className={cn("tnum text-sm font-semibold sm:text-xs", up ? "text-profit" : "text-loss")}>
        {up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
      </div>
    </div>
  );
}

function Section({
  title,
  quotes,
  showSpark,
}: {
  title: string;
  quotes: Quote[];
  showSpark?: boolean;
}) {
  if (!quotes.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-300">
        {title}
      </p>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] sm:snap-none sm:gap-2.5">
        {quotes.map((q) => (
          <QuoteCard key={q.symbol} q={q} showSpark={showSpark} />
        ))}
      </div>
    </div>
  );
}

function SkeletonRow({ title, count }: { title: string; count: number }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-300">
        {title}
      </p>
      <div className="flex gap-3 overflow-hidden sm:gap-2.5">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-[84px] w-[46vw] shrink-0 animate-pulse rounded-lg border border-border bg-card/60 sm:h-[68px] sm:w-auto sm:min-w-[148px]"
          />
        ))}
      </div>
    </div>
  );
}

export function LiveMarketTicker() {
  const [data, setData] = useState<MarketData | null>(null);
  const [errored, setErrored] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/market/quotes", { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MarketData;
        if (active) {
          setData(json);
          setErrored(false);
        }
      } catch {
        // Keep last-known data on a transient failure.
        if (active) setErrored(true);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, []);

  // Auto-dismiss the mobile "Swipe →" hint after the first few seconds.
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const s = data?.sections;
  const hasAny =
    !!s && s.crypto.length + s.forex.length + s.stocks.length + s.metals.length > 0;

  return (
    <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
      <div className="rounded-2xl border border-gold-400/20 bg-background/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75",
                  errored ? "bg-loss" : "animate-ping bg-profit"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  errored ? "bg-loss" : "bg-profit"
                )}
              />
            </span>
            <span className="text-sm font-semibold">Live Markets</span>
          </div>
          <div className="flex items-center gap-2">
            {hasAny && showHint && (
              <span className="animate-pulse text-[11px] font-medium text-gold-300 md:hidden">
                Swipe →
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {hasAny ? "Auto-updating · 20s" : "Loading…"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {data && hasAny ? (
            <>
              <Section title="Crypto" quotes={data.sections.crypto} showSpark />
              <Section title="Forex" quotes={data.sections.forex} />
              <Section title="Stocks" quotes={data.sections.stocks} />
              <Section title="Metals" quotes={data.sections.metals} />
            </>
          ) : (
            <>
              <SkeletonRow title="Crypto" count={5} />
              <SkeletonRow title="Forex" count={6} />
              <SkeletonRow title="Stocks" count={5} />
              <SkeletonRow title="Metals" count={2} />
            </>
          )}
        </div>

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Market data for illustration only · delayed/indicative · not financial advice
        </p>
      </div>
    </section>
  );
}
