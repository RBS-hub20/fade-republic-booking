"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BellRing, X } from "lucide-react";

/**
 * Predictive alert. This is the whole thesis of the product in one strip: the
 * agent noticed the deadline first and is asking for permission, not input.
 */
export function ProactiveBanner({
  visible,
  onConfirm,
  onDefer,
}: {
  visible: boolean;
  onConfirm: () => void;
  onDefer: () => void;
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden px-4 pt-4 sm:px-6"
        >
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-egov-yellow/45 bg-egov-yellow/[0.07] px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-egov-yellow/15 text-egov-yellow">
              <BellRing className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-white/85">
              <span className="font-semibold text-white">Boss, due ng SSS mo in 3 days.</span>{" "}
              Bayaran ko na?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="h-8 rounded-lg bg-egov-yellow px-3.5 text-[12.5px] font-semibold text-[#1A1400] transition hover:bg-[#ffdc45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egov-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-egov-bg"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={onDefer}
                className="h-8 rounded-lg border border-white/15 px-3.5 text-[12.5px] font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                Later
              </button>
              <button
                type="button"
                onClick={onDefer}
                aria-label="Dismiss alert"
                className="rounded-md p-1 text-white/35 transition hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
