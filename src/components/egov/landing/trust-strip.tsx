"use client";

import { motion } from "framer-motion";
import { BellRing, KeyRound, ReceiptText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PILLARS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: KeyRound,
    title: "Vault encrypted on your device",
    body: "Your IDs are sealed with AES-GCM 256 through Web Crypto and stored in IndexedDB. The key never leaves the browser, and no document is ever uploaded.",
  },
  {
    icon: ReceiptText,
    title: "Anti-Fixer Receipt",
    body: "Every filing gets a tracking number, an official fee line, and a timestamped audit trail. If it is not on the receipt, nobody was paid for it.",
  },
  {
    icon: BellRing,
    title: "Predictive alerts",
    body: "SuperAgent watches your due dates — SSS PRN, PhilHealth validity, PSA releases — and warns you days before, not after the penalty.",
  },
];

export function TrustStrip() {
  return (
    <section id="trust" className="relative px-6 pb-28">
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className="eg-panel eg-sheen rounded-2xl p-6"
          >
            <p.icon className="h-5 w-5 text-egov-action" />
            <h3 className="mt-4 text-base font-semibold text-white">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
