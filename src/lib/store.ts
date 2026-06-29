"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Symbols offered in the charts page switcher. `gold` flags the XAUUSD accent. */
export const SYMBOLS = [
  { value: "OANDA:XAUUSD", label: "XAU/USD", short: "Gold", gold: true },
  { value: "OANDA:EURUSD", label: "EUR/USD", short: "Euro", gold: false },
  { value: "OANDA:GBPUSD", label: "GBP/USD", short: "Cable", gold: false },
  { value: "OANDA:USDJPY", label: "USD/JPY", short: "Yen", gold: false },
  { value: "BINANCE:BTCUSDT", label: "BTC/USD", short: "Bitcoin", gold: false },
] as const;

export const TIMEFRAMES = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "D", label: "1D" },
] as const;

interface ChartState {
  symbol: string;
  interval: string;
  selectedClientId: string | null;
  setSymbol: (symbol: string) => void;
  setInterval: (interval: string) => void;
  setSelectedClientId: (id: string | null) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: "OANDA:XAUUSD",
      interval: "60",
      selectedClientId: null,
      setSymbol: (symbol) => set({ symbol }),
      setInterval: (interval) => set({ interval }),
      setSelectedClientId: (selectedClientId) => set({ selectedClientId }),
    }),
    { name: "rscfx-chart" }
  )
);
