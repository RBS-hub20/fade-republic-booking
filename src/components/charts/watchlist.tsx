"use client";

import { useEffect, useRef } from "react";

/**
 * Live watchlist using TradingView's free "Market Quotes" widget.
 * Shows last price and % change for the portal's tracked symbols.
 */
const SYMBOLS = [
  { proName: "OANDA:XAUUSD", title: "Gold (XAU/USD)" },
  { proName: "OANDA:EURUSD", title: "EUR/USD" },
  { proName: "OANDA:GBPUSD", title: "GBP/USD" },
  { proName: "OANDA:USDJPY", title: "USD/JPY" },
  { proName: "BINANCE:BTCUSDT", title: "BTC/USD" },
];

export function Watchlist() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: "100%",
      symbolsGroups: [
        {
          name: "Watchlist",
          symbols: SYMBOLS,
        },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      colorTheme: "dark",
      locale: "en",
      backgroundColor: "rgba(15, 17, 22, 1)",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return <div ref={ref} className="tradingview-widget-container h-full w-full" />;
}
