"use client";

import { useEffect, useRef } from "react";

/**
 * TradingView Advanced Chart widget.
 *
 * Uses TradingView's FREE embeddable widget — no API key required. The widget
 * is injected by appending their script into a container div; we re-inject it
 * whenever the symbol or interval changes.
 *
 * NOTE: This is market data only (read-only charting). To place real trades you
 * would integrate a broker's trading API separately — see /charts page comments.
 */
export function TradingViewChart({
  symbol,
  interval,
}: {
  symbol: string;
  interval: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any previous widget instance.
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget h-full w-full";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Manila",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      backgroundColor: "rgba(15, 17, 22, 1)",
      gridColor: "rgba(45, 51, 61, 0.4)",
      hide_side_toolbar: false,
      allow_symbol_change: true,
      details: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, interval]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container h-full w-full"
    />
  );
}
