"use client";

import { useEffect, useRef } from "react";

/**
 * TradingView "Ticker Tape" — a live, scrolling markets strip (crypto, forex,
 * stocks, metals) for the landing page. Loads TradingView's embed script into a
 * container it fully owns; rebuilt on mount (StrictMode-safe) and torn down on
 * unmount. Requires outbound access to s3.tradingview.com — renders live in
 * production; degrades to empty space if the network is unavailable.
 */
const SYMBOLS = [
  { proName: "BINANCE:BTCUSDT", title: "BTC" },
  { proName: "BINANCE:ETHUSDT", title: "ETH" },
  { proName: "FX:EURUSD", title: "EUR/USD" },
  { proName: "FX:GBPUSD", title: "GBP/USD" },
  { proName: "NASDAQ:AAPL", title: "AAPL" },
  { proName: "NASDAQ:NVDA", title: "NVDA" },
  { proName: "TVC:GOLD", title: "XAU/USD" },
  { proName: "TVC:SILVER", title: "XAG/USD" },
];

export function TickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Build TradingView's required DOM fresh each mount (the embed script looks
    // for a sibling `__widget` div). Clearing first makes React StrictMode's
    // double-invoke idempotent — no duplicate tapes.
    container.innerHTML = '<div class="tradingview-widget-container__widget"></div>';

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: SYMBOLS,
      showSymbolLogo: true,
      colorTheme: "dark",
      isTransparent: true,
      displayMode: "adaptive",
      locale: "en",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <section
      className="mx-auto mt-12 w-full max-w-6xl overflow-hidden rounded-2xl border border-gold-400/20 bg-background/40 px-1 py-1"
      aria-label="Live market ticker"
    >
      <div ref={containerRef} className="tradingview-widget-container" />
    </section>
  );
}
