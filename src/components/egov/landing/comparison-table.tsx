"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Row {
  capability: string;
  agent: string;
  superAgent: string;
  /** The old agent genuinely lacks this — render it as a miss, not a lesser yes. */
  agentHas: boolean;
}

const ROWS: Row[] = [
  { capability: "How it works", agent: "Reactive", superAgent: "Autonomous Swarm", agentHas: false },
  { capability: "Interface", agent: "Chat Only", superAgent: "Generative UI", agentHas: false },
  { capability: "Context", agent: "No Memory", superAgent: "Memory Graph", agentHas: false },
  { capability: "Documents", agent: "No Vault", superAgent: "Encrypted Vault", agentHas: false },
  { capability: "Accountability", agent: "None", superAgent: "Anti-Fixer Receipt", agentHas: false },
  { capability: "Deadlines", agent: "You remember", superAgent: "Predictive Alerts", agentHas: false },
];

export function ComparisonTable() {
  return (
    <section id="compare" className="relative px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-egov-action">The difference</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            An agent answers. A SuperAgent finishes the errand.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/50">
            Hindi lang siya chatbot. It holds your documents, remembers your record, files on your
            behalf, and hands you a receipt for every step.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
        >
          {/* Horizontal scroll keeps all three columns intact on phones. */}
          <div className="overflow-x-auto eg-scroll">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="w-[34%] px-6 py-5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
                    Capability
                  </th>
                  <th className="w-[33%] px-6 py-5 text-sm font-medium text-white/55">eGov Agent</th>
                  <th className="w-[33%] border-l border-egov-action/25 bg-egov-action/[0.07] px-6 py-5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">
                      eGov SuperAgent
                      <span className="rounded-full bg-egov-green/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-egov-green">
                        This build
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr
                    key={row.capability}
                    className={cn(
                      "border-b border-white/[0.06] last:border-b-0",
                      i % 2 === 1 && "bg-white/[0.012]"
                    )}
                  >
                    <td className="px-6 py-4 text-sm text-white/45">{row.capability}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 text-sm text-white/45">
                        <X className="h-4 w-4 shrink-0 text-egov-red/80" aria-hidden />
                        {row.agent}
                      </span>
                    </td>
                    <td className="border-l border-egov-action/25 bg-egov-action/[0.07] px-6 py-4">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                        <Check className="h-4 w-4 shrink-0 text-egov-green" aria-hidden />
                        {row.superAgent}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
