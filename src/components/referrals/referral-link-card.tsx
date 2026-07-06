"use client";

import { useState } from "react";
import Link from "next/link";
import { Share2, Copy, Check, Info, ArrowRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatUsd } from "@/lib/utils";
import type { ReferralSummary } from "@/lib/referrals";

export function ReferralLinkCard({ summary }: { summary: ReferralSummary }) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(false);

  const isPlatinum = summary.tierName === "Platinum";
  const exampleAmount = Math.round(100 * (summary.commissionRate / 100) * 100) / 100;

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary.link);
    } catch {
      /* clipboard may be blocked — the field is selectable as a fallback */
    }
    setCopied(true);
    setToast(true);
    setTimeout(() => setCopied(false), 1500);
    setTimeout(() => setToast(false), 2200);
  }

  return (
    <Card className="relative overflow-hidden rounded-xl border-border p-5 sm:p-6">
      {/* subtle gold wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold-400/[0.06] to-transparent" />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold-400/15 text-gold-300">
            <Share2 className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-bold tracking-tight">Your Exclusive Referral Link</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite friends and earn commission when they activate their first QX Tier.
        </p>

        {/* Link + copy */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={summary.link}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-lg border border-[#333333] bg-[#1A1A1A] px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-gold-400/60"
            aria-label="Your referral link"
          />
          <Button onClick={copy} className="shrink-0 gap-2 sm:w-auto">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#888888]">
          <Users className="h-4 w-4" />
          <span>Total Referrals: <span className="font-semibold text-foreground">{summary.totalReferrals}</span></span>
          <span className="text-[#444]">|</span>
          <span>Active: <span className="font-semibold text-profit">{summary.activeReferrals}</span></span>
          <span className="text-[#444]">|</span>
          <span>Pending: <span className="font-semibold text-gold-300">{summary.pendingReferrals}</span></span>
        </div>

        {/* Tiered commission display */}
        <div className="mt-5 rounded-lg border border-border bg-background/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gold-300 sm:text-base">
              Earn {summary.commissionRate}% commission on your referral&apos;s first package
            </p>
            <Tooltip text="Commission is credited once your referral activates their first QX Tier.">
              <Info className="h-4 w-4 text-muted-foreground hover:text-gold-300" />
            </Tooltip>
          </div>

          <p className="mt-1.5 text-sm text-muted-foreground">
            Example: Refer a friend to Silver $100 →{" "}
            <span className="font-semibold text-gold-300">You earn {formatUsd(exampleAmount)}</span>
          </p>

          {!isPlatinum && (
            <Link
              href="/qx-tiers"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gold-300 hover:underline"
            >
              Upgrade to Platinum to earn up to 8% per referral
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Total earned */}
        <p className="mt-4 text-[18px] font-bold text-gold-400">
          Total Earned from Referrals: {formatUsd(summary.totalEarned)}
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg border border-gold-400/40 bg-[#1A1A1A] px-3 py-2 text-sm text-gold-200 shadow-lg">
          <Check className="h-4 w-4 text-profit" />
          Copied to clipboard!
        </div>
      )}
    </Card>
  );
}

/** Lightweight hover/focus tooltip (no external dependency). */
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex" tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-md border border-border bg-[#1A1A1A] px-3 py-2 text-xs text-muted-foreground opacity-0 shadow-lg transition-opacity",
          "group-hover:opacity-100 group-focus:opacity-100"
        )}
      >
        {text}
      </span>
    </span>
  );
}
