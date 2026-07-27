"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The white "document" surface the agent renders inside the dark chat.
 *
 * The contrast flip is deliberate: anything on white is an official record the
 * user can download or show at a counter; anything on navy is the agent talking.
 */
export function GenerativeCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "w-full overflow-hidden rounded-2xl bg-white text-[#0B1220] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] ring-1 ring-black/5",
        className
      )}
    >
      {children}
    </motion.article>
  );
}

export function CardHeader({
  agency,
  title,
  badge,
  badgeTone = "green",
  meta,
  icon,
}: {
  agency: string;
  title: string;
  badge?: string;
  badgeTone?: "green" | "blue" | "yellow";
  meta?: string;
  icon?: ReactNode;
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
    yellow: "bg-amber-50 text-amber-800 ring-amber-600/20",
  } as const;

  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.07] px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-egov-navy/10 text-egov-navy">
            {icon}
          </span>
        ) : null}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">
            {agency}
          </p>
          <h3 className="mt-1 text-[17px] font-semibold leading-tight tracking-tight">{title}</h3>
          {meta ? <p className="mt-1 text-xs text-black/50">{meta}</p> : null}
        </div>
      </div>
      {badge ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
            tones[badgeTone]
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {badge}
        </span>
      ) : null}
    </header>
  );
}

export function CardActions({ children }: { children: ReactNode }) {
  return (
    <footer className="flex flex-wrap items-center gap-2 border-t border-black/[0.07] bg-[#F7F9FC] px-5 py-3.5 sm:px-6">
      {children}
    </footer>
  );
}

export function CardButton({
  children,
  onClick,
  variant = "primary",
  icon,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egov-action focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-egov-action text-white hover:bg-[#1878d8]"
          : "border border-black/10 bg-white text-black/70 hover:bg-black/[0.04]"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Small label/value pair used across all three cards. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-black/85">{value}</dd>
    </div>
  );
}
