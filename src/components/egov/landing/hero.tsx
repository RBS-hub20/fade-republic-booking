"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { EgovLogo } from "@/components/egov/logo";

const STATS = [
  { value: "115M", label: "Filipinos served" },
  { value: "4", label: "Agencies connected" },
  { value: "0", label: "Fixers needed" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-14 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 eg-grid" aria-hidden />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/70 backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5 text-egov-yellow" />
          Autonomous agent swarm for Philippine e-government
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {/* Backlight: the wordmark's "eGov" half is brand navy, which would
              otherwise sink into the #050A18 canvas. A luminous plate behind it
              restores contrast without recolouring the logo. */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[660px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(110,170,255,0.34) 0%, rgba(30,144,255,0.22) 48%, transparent 100%)",
            }}
            aria-hidden
          />
          <EgovLogo
            variant="main"
            width={420}
            priority
            className="relative eg-float [filter:drop-shadow(0_0_18px_rgba(255,255,255,0.28))]"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-10 text-balance text-5xl font-semibold tracking-tight eg-text-gradient sm:text-6xl md:text-7xl"
        >
          Super Agent. All Services.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-white/60 sm:text-xl"
        >
          The Autonomous eGov OS for 115M Filipinos. <span className="text-white/85">Utusan mo lang.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link
            href="/app"
            className="group inline-flex h-12 items-center gap-2 rounded-xl bg-egov-action px-7 text-[15px] font-semibold text-white shadow-[0_16px_40px_-12px_rgba(30,144,255,0.75)] transition hover:bg-[#3ba0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egov-action focus-visible:ring-offset-2 focus-visible:ring-offset-egov-bg"
          >
            Launch SuperAgent
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <span className="inline-flex items-center gap-2 text-sm text-white/45">
            <ShieldCheck className="h-4 w-4 text-egov-green" />
            Vault encrypted on your device
          </span>
        </motion.div>

        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 grid w-full max-w-xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] py-6"
        >
          {STATS.map((s) => (
            <div key={s.label} className="px-4">
              <dt className="text-2xl font-semibold text-white sm:text-3xl">{s.value}</dt>
              <dd className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/40">{s.label}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
