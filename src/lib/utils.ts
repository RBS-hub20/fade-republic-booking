import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as USD currency. */
export function formatUsd(value: number, opts?: { compact?: boolean }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    notation: opts?.compact ? "compact" : "standard",
  }).format(value);
}

/** Format a number as a percentage with a fixed precision. */
export function formatPct(value: number, digits = 2): string {
  return `${value >= 0 ? "" : ""}${value.toFixed(digits)}%`;
}

/** Format an ISO date / Date as a short readable date (Manila). */
export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...opts,
  }).format(d);
}

/** A `yyyy-MM-dd` key turned into a readable label without TZ drift. */
export function formatDateKey(key: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}
