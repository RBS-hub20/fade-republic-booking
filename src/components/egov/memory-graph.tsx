"use client";

import { motion } from "framer-motion";
import { BrainCircuit } from "lucide-react";
import { MEMORY_FACTS } from "@/lib/egov/data";

export function MemoryGraph() {
  return (
    <section className="eg-panel eg-sheen rounded-xl p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <BrainCircuit className="h-3.5 w-3.5 text-egov-action" />
          Naalala ko
        </h2>
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">Memory graph</span>
      </header>

      <ul className="mt-3 space-y-2.5">
        {MEMORY_FACTS.map((fact, i) => (
          <motion.li
            key={fact.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i }}
            className="relative pl-4"
          >
            {/* Node + connector: the graph edge running down the rail. */}
            <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-egov-action" />
            {i < MEMORY_FACTS.length - 1 ? (
              <span className="absolute left-[2.5px] top-3.5 h-[calc(100%+2px)] w-px bg-gradient-to-b from-egov-action/45 to-transparent" />
            ) : null}
            <p className="text-[12.5px] leading-tight text-white/80">
              <span className="text-white/45">{fact.label}: </span>
              <span className="font-medium text-white">{fact.value}</span>
            </p>
            <p className="mt-0.5 text-[10.5px] text-white/30">{fact.detail}</p>
          </motion.li>
        ))}
      </ul>

      <p className="mt-3.5 border-t border-white/[0.07] pt-2.5 text-[10.5px] leading-snug text-white/30">
        Hindi na kita tatanungin ulit — natatandaan ko na.
      </p>
    </section>
  );
}
