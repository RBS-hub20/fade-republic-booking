"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Copy, ReceiptText, ShieldCheck } from "lucide-react";
import { RECEIPT, peso, phDate } from "@/lib/egov/data";

export function AntiFixerReceipt() {
  const [escalated, setEscalated] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyTracking() {
    try {
      await navigator.clipboard.writeText(RECEIPT.trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard denied — the number is on screen anyway.
    }
  }

  return (
    <section className="eg-panel eg-sheen rounded-xl p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <ReceiptText className="h-3.5 w-3.5 text-egov-action" />
          Anti-Fixer Receipt
        </h2>
        <button
          type="button"
          onClick={copyTracking}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white/45 transition hover:bg-white/5 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3 text-egov-green" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy #"}
        </button>
      </header>

      <p className="mt-3 font-mono text-[15px] font-semibold tracking-tight text-white">
        {RECEIPT.trackingNumber}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        {[
          ["Agency", RECEIPT.agency],
          ["Requested", RECEIPT.requestedLabel],
          ["ETA", `${RECEIPT.etaLabel} • ${phDate(RECEIPT.etaDate)}`],
          ["Official fee", peso(RECEIPT.officialFee)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</dt>
            <dd className="mt-0.5 text-[12.5px] font-medium text-white/85">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-egov-action">{RECEIPT.stage}</span>
          <span className="tabular-nums text-white/45">{RECEIPT.progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${RECEIPT.progress}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-egov-action to-egov-green"
          />
        </div>
      </div>

      <ol className="mt-4 space-y-2 border-t border-white/[0.07] pt-3">
        {RECEIPT.auditTrail.map((entry) => (
          <li key={entry.at} className="flex gap-2.5 text-[11.5px] leading-snug">
            <span className="shrink-0 font-mono text-white/35">{entry.at}</span>
            <span className="text-white/55">{entry.event}</span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => setEscalated(true)}
        disabled={escalated}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-egov-yellow/35 bg-egov-yellow/10 py-2 text-[12.5px] font-semibold text-egov-yellow transition hover:bg-egov-yellow/20 disabled:cursor-default disabled:border-egov-green/30 disabled:bg-egov-green/10 disabled:text-egov-green"
      >
        {escalated ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {escalated ? "Escalated — agency notified" : "Escalate"}
      </button>

      <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-snug text-white/30">
        <ShieldCheck className="mt-px h-3 w-3 shrink-0 text-egov-green/70" />
        All actions logged, no fixer. Official fees only — {RECEIPT.paidTo}.
      </p>
    </section>
  );
}
