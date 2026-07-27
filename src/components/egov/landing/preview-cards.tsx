"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, HeartPulse, PiggyBank, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { peso, philHealth, psa, sss } from "@/lib/egov/data";

interface Preview {
  icon: LucideIcon;
  agency: string;
  title: string;
  body: string;
  metric: string;
  metricLabel: string;
  accent: string;
  prompt: string;
}

const PREVIEWS: Preview[] = [
  {
    icon: PiggyBank,
    agency: "SSS",
    title: "Contributions, always current",
    body: "Six straight months posted by RBS Labs Inc. SuperAgent checks every payday and files your PRN before the deadline.",
    metric: peso(sss.member.monthlyContribution),
    metricLabel: "per month • up to date",
    accent: "#1E90FF",
    prompt: "check my sss contributions",
  },
  {
    icon: HeartPulse,
    agency: "PhilHealth",
    title: "Coverage for the whole household",
    body: `Active membership with ${philHealth.dependents.length} dependents on file, valid until December 2026 — Konsulta included.`,
    metric: `${philHealth.dependents.length} dependents`,
    metricLabel: "active coverage",
    accent: "#20C997",
    prompt: "show my philhealth",
  },
  {
    icon: ScrollText,
    agency: "PSA",
    title: "Birth certificate, no queue",
    body: `Filed, paid, and tracked end-to-end. Tracking ${psa.request.trackingNumber} — ready for pickup in ${psa.request.etaDays} days.`,
    metric: `${psa.request.etaDays} days`,
    metricLabel: "to pickup • no fixer",
    accent: "#FCD116",
    prompt: "request psa birth certificate",
  },
];

export function PreviewCards() {
  return (
    <section id="services" className="relative px-6 pb-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-egov-action">Connected today</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Three agencies. One utos.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-white/45">
            Every card below is real generative UI — the agent renders it inside the chat the moment
            it understands what you need.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEWS.map((p, i) => (
            <motion.div
              key={p.agency}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
            >
              <Link
                href={{ pathname: "/app", query: { q: p.prompt } }}
                className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egov-action"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl border"
                    style={{
                      borderColor: `${p.accent}40`,
                      background: `${p.accent}14`,
                      color: p.accent,
                    }}
                  >
                    <p.icon className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-white/25 transition group-hover:text-white/70" />
                </div>

                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  {p.agency}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{p.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/50">{p.body}</p>

                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="text-xl font-semibold text-white">{p.metric}</p>
                  <p className="mt-0.5 text-xs text-white/40">{p.metricLabel}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
