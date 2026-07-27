"use client";

import { X } from "lucide-react";
import { VaultPreview } from "@/components/vault/vault-preview";
import { AntiFixerReceipt } from "@/components/receipts/anti-fixer-receipt";
import { MemoryGraph } from "./memory-graph";

/**
 * Right rail: what the agent is holding (vault), what it is doing (receipt),
 * and what it knows (memory). Rendered inline on wide screens and as a drawer
 * on everything narrower.
 */
export function InsightRail({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#070D1E]">
      {onClose ? (
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3 xl:hidden">
          <p className="text-[13px] font-semibold text-white">Vault &amp; receipts</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-md p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex-1 space-y-3 overflow-y-auto p-4 eg-scroll">
        <VaultPreview />
        <AntiFixerReceipt />
        <MemoryGraph />
      </div>
    </div>
  );
}
