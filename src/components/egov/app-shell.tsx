"use client";

import { Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { ChatPanel } from "./chat-panel";
import { InsightRail } from "./insight-rail";
import { Sidebar } from "./sidebar";
import { EgovLogo } from "./logo";

export function AppShell() {
  // Bumping the key remounts the chat — that is what "new conversation" means.
  const [conversationKey, setConversationKey] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  function newConversation() {
    setConversationKey((k) => k + 1);
    setNavOpen(false);
  }

  return (
    <div className="eg-root flex h-[100dvh] flex-col overflow-hidden">
      {/* Mobile top bar — the desktop layout puts the logo in the sidebar. */}
      <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="rounded-lg border border-white/10 p-1.5 text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <Menu className="h-4 w-4" />
        </button>
        <EgovLogo variant="white" width={126} />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[280px] shrink-0 border-r border-white/[0.07] lg:block">
          <Sidebar
            onNewConversation={newConversation}
            onOpenMemory={() => setRailOpen(true)}
            onOpenVault={() => setRailOpen(true)}
          />
        </aside>

        <main className="min-w-0 flex-1 eg-ambient">
          <Suspense fallback={null}>
            <ChatPanel key={conversationKey} onOpenRail={() => setRailOpen(true)} />
          </Suspense>
        </main>

        <aside className="hidden w-[320px] shrink-0 border-l border-white/[0.07] xl:block">
          <InsightRail />
        </aside>
      </div>

      {/* Drawers */}
      <AnimatePresence>
        {navOpen ? (
          <motion.div
            key="nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setNavOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute inset-y-0 left-0 w-[280px] border-r border-white/[0.07] shadow-2xl"
            >
              <Sidebar
                onNewConversation={newConversation}
                onOpenMemory={() => {
                  setNavOpen(false);
                  setRailOpen(true);
                }}
                onOpenVault={() => {
                  setNavOpen(false);
                  setRailOpen(true);
                }}
                onClose={() => setNavOpen(false)}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {railOpen ? (
          <motion.div
            key="rail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 xl:hidden"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setRailOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: 340 }}
              animate={{ x: 0 }}
              exit={{ x: 340 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute inset-y-0 right-0 w-[min(340px,88vw)] border-l border-white/[0.07] shadow-2xl"
            >
              <InsightRail onClose={() => setRailOpen(false)} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
