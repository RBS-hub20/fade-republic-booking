import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aggregated live market quotes for the public homepage ticker.
 *
 * Sources (all free, no API key):
 *   - Crypto:  CoinGecko /coins/markets (price, 24h %, 7d sparkline)
 *   - Forex/Stocks/Metals: Yahoo Finance v8 chart (price, prev close → daily %)
 *
 * Behaviour:
 *   - In-memory cache for 15s (per serverless instance) to limit upstream calls.
 *   - Each section fetched independently; on failure it falls back to the last
 *     good value from cache (graceful degradation, `stale: true`).
 *   - Every upstream fetch is timeout-bounded so the route never hangs.
 *
 * Optional env overrides (defaults are the public endpoints):
 *   COINGECKO_API_URL, YAHOO_FINANCE_URL
 */

const CACHE_TTL = 15_000;
const FETCH_TIMEOUT = 8_000;

const COINGECKO = process.env.COINGECKO_API_URL || "https://api.coingecko.com/api/v3";
const YAHOO = process.env.YAHOO_FINANCE_URL || "https://query1.finance.yahoo.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

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
  sections: {
    crypto: Quote[];
    forex: Quote[];
    stocks: Quote[];
    metals: Quote[];
  };
}

let cache: { at: number; data: MarketData } | null = null;

async function fetchJson(url: string, extraHeaders?: Record<string, string>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...extraHeaders },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---- Crypto (CoinGecko) ----
const CRYPTO_IDS = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" },
  { id: "binancecoin", symbol: "BNB" },
  { id: "ripple", symbol: "XRP" },
];

function downsample(arr: number[], target = 24): number[] {
  if (!Array.isArray(arr) || arr.length <= target) return arr ?? [];
  const step = arr.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  out.push(arr[arr.length - 1]);
  return out;
}

async function fetchCrypto(): Promise<Quote[]> {
  const ids = CRYPTO_IDS.map((c) => c.id).join(",");
  const url = `${COINGECKO}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`;
  // Optional CoinGecko demo API key improves rate limits; works without one.
  const headers = process.env.COINGECKO_API_KEY
    ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY }
    : undefined;
  const data = await fetchJson(url, headers);
  const byId = new Map<string, any>((data ?? []).map((d: any) => [d.id, d]));
  return CRYPTO_IDS.map(({ id, symbol }) => {
    const d = byId.get(id);
    return {
      symbol,
      name: d?.name ?? symbol,
      price: Number(d?.current_price ?? 0),
      changePct: Number(d?.price_change_percentage_24h ?? 0),
      sparkline: downsample(d?.sparkline_in_7d?.price ?? []),
    };
  });
}

// ---- Yahoo (forex / stocks / metals) ----
async function fetchYahooOne(yahooSymbol: string, display: string, name?: string): Promise<Quote> {
  const url = `${YAHOO}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const data = await fetchJson(url);
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`no data for ${yahooSymbol}`);
  const price = Number(meta.regularMarketPrice ?? 0);
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
  const changePct = prev ? ((price - prev) / prev) * 100 : 0;
  return { symbol: display, name, price, changePct };
}

async function fetchYahooGroup(
  items: { y: string; d: string; name?: string }[]
): Promise<Quote[]> {
  const results = await Promise.all(
    items.map((it) =>
      fetchYahooOne(it.y, it.d, it.name).then(
        (q) => ({ ok: true as const, q }),
        () => ({ ok: false as const })
      )
    )
  );
  const quotes = results.filter((r) => r.ok).map((r) => (r as any).q as Quote);
  if (quotes.length === 0) throw new Error("yahoo group failed");
  return quotes;
}

const FOREX = [
  { y: "EURUSD=X", d: "EUR/USD" },
  { y: "GBPUSD=X", d: "GBP/USD" },
  { y: "USDJPY=X", d: "USD/JPY" },
  { y: "USDCHF=X", d: "USD/CHF" },
  { y: "AUDUSD=X", d: "AUD/USD" },
  { y: "USDCAD=X", d: "USD/CAD" },
];
const STOCKS = [
  { y: "AAPL", d: "AAPL", name: "Apple" },
  { y: "NVDA", d: "NVDA", name: "NVIDIA" },
  { y: "MSFT", d: "MSFT", name: "Microsoft" },
  { y: "TSLA", d: "TSLA", name: "Tesla" },
  { y: "AMZN", d: "AMZN", name: "Amazon" },
];
const METALS = [
  { y: "GC=F", d: "XAU/USD", name: "Gold" },
  { y: "SI=F", d: "XAG/USD", name: "Silver" },
];

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const prev = cache?.data.sections;
  const [crypto, forex, stocks, metals] = await Promise.all([
    fetchCrypto().catch(() => null),
    fetchYahooGroup(FOREX).catch(() => null),
    fetchYahooGroup(STOCKS).catch(() => null),
    fetchYahooGroup(METALS).catch(() => null),
  ]);

  const anyFailed = [crypto, forex, stocks, metals].some((x) => x === null);

  const data: MarketData = {
    updatedAt: new Date().toISOString(),
    stale: anyFailed,
    sections: {
      crypto: crypto ?? prev?.crypto ?? [],
      forex: forex ?? prev?.forex ?? [],
      stocks: stocks ?? prev?.stocks ?? [],
      metals: metals ?? prev?.metals ?? [],
    },
  };

  // Only overwrite the cache when we have at least something; keep last-good otherwise.
  cache = { at: now, data };

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
  });
}
