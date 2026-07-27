"use client";

import Link from "next/link";
import { BrainCircuit, Lock, Plus, X } from "lucide-react";
import { EgovLogo } from "@/components/egov/logo";
import { AGENCIES, USER } from "@/lib/egov/data";
import { cn } from "@/lib/utils";

export function Sidebar({
  onNewConversation,
  onOpenMemory,
  onOpenVault,
  onClose,
}: {
  onNewConversation: () => void;
  onOpenMemory: () => void;
  onOpenVault: () => void;
  /** Present only when the sidebar is rendered as a mobile drawer. */
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col bg-[#070D1E]">
      <div className="flex items-start justify-between px-5 pb-4 pt-5">
        <Link href="/egov" aria-label="eGov SuperAgent home">
          <EgovLogo variant="white" width={180} priority />
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1 text-white/45 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-[13.5px] font-semibold text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </button>
      </div>

      <nav className="mt-7 flex-1 overflow-y-auto px-4 eg-scroll">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          Connected Agencies
        </p>
        <ul className="mt-3 space-y-0.5">
          {AGENCIES.map((agency) => (
            <li key={agency.id}>
              <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 transition hover:bg-white/[0.05]">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    agency.connected ? "bg-egov-green eg-pulse" : "bg-white/25"
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-white/90">{agency.name}</p>
                  <p className="truncate text-[10.5px] text-white/35">{agency.detail}</p>
                </div>
                <span className="shrink-0 text-[10.5px] font-medium text-egov-green">
                  {agency.connected ? "Connected" : "Off"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/[0.07] px-4 py-3">
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={onOpenMemory}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <BrainCircuit className="h-4 w-4 text-white/45" />
            Memory
            <span className="ml-auto text-[10px] text-white/30">4 facts</span>
          </button>
          <button
            type="button"
            onClick={onOpenVault}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Lock className="h-4 w-4 text-white/45" />
            Vault
            <span className="ml-auto text-[10px] text-egov-yellow/80">Encrypted</span>
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-egov-action/20 text-[11px] font-semibold text-egov-action ring-1 ring-inset ring-egov-action/30">
            {USER.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{USER.name}</p>
            <p className="truncate text-[10.5px] text-white/35">
              {USER.role} • {USER.location}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
