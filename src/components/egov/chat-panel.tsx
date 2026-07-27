"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PanelRight, Sparkles } from "lucide-react";
import { Composer } from "./composer";
import { ProactiveBanner } from "./proactive-banner";
import { PhilHealthCard, PSATrackerCard, SSSContributionsCard } from "@/components/generative-ui";
import { LOGOS } from "@/lib/egov/brand";
import { respond, type CardKind } from "@/lib/egov/agent";
import { USER, peso, phDate, sss } from "@/lib/egov/data";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "agent" | "user";
  text: string;
  card: CardKind;
  suggestions?: string[];
}

const WELCOME: Message = {
  id: "welcome",
  role: "agent",
  text: "Kumusta boss! I am SuperAgent. Utusan mo ako — check SSS, PhilHealth, o request PSA.",
  card: null,
  suggestions: ["Check my SSS contributions", "Show my PhilHealth", "Request PSA birth certificate"],
};

let counter = 0;
const nextId = () => `m${++counter}-${Date.now().toString(36)}`;

function AgentAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-egov-navy/60">
      <Image src={LOGOS.markWhite} alt="" width={40} height={26} className="h-4 w-auto" />
    </span>
  );
}

function CardFor({ kind }: { kind: CardKind }) {
  if (kind === "sss") return <SSSContributionsCard />;
  if (kind === "philhealth") return <PhilHealthCard />;
  if (kind === "psa") return <PSATrackerCard />;
  return null;
}

function Working({ agencies }: { agencies: string[] }) {
  const label = agencies.length
    ? `Kinakausap ko ang ${agencies.join(", ")}…`
    : "Iniisip ko pa…";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3"
    >
      <AgentAvatar />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-egov-action"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
            />
          ))}
        </span>
        <span className="text-[12.5px] text-white/55">{label}</span>
      </div>
    </motion.div>
  );
}

export function ChatPanel({ onOpenRail }: { onOpenRail: () => void }) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [working, setWorking] = useState<string[] | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const searchParams = useSearchParams();
  const seededQuery = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, working]);

  // Clear pending reply timers if the conversation unmounts mid-flight.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = useCallback((text: string) => {
    const turn = respond(text);
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text, card: null }]);
    setWorking(turn.working);

    const t = setTimeout(() => {
      setWorking(null);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "agent",
          text: turn.reply,
          card: turn.card,
          suggestions: turn.suggestions,
        },
      ]);
    }, turn.card ? 900 : 600);
    timers.current.push(t);
  }, []);

  // A preview card on the landing page can deep-link a first utos: /app?q=…
  useEffect(() => {
    const q = searchParams?.get("q");
    if (!q || seededQuery.current) return;
    seededQuery.current = true;
    send(q);
  }, [searchParams, send]);

  function confirmPayment() {
    setBannerVisible(false);
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text: "Yes, bayaran mo na.", card: null },
    ]);
    setWorking(["SSS"]);
    const t = setTimeout(() => {
      setWorking(null);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "agent",
          text: `Sige boss — naka-schedule na ang ${peso(sss.nextDue.amount)} para sa ${sss.nextDue.period}, babayaran ${phDate(
            sss.nextDue.dueDate
          )} via ${sss.nextDue.channel}. Nasa Anti-Fixer Receipt ang PRN at resibo pagkatapos — official fee lang, walang dagdag.`,
          card: "sss",
          suggestions: ["Show the receipt", "Check my PhilHealth", "Track my PSA request"],
        },
      ]);
    }, 900);
    timers.current.push(t);
  }

  function deferPayment() {
    setBannerVisible(false);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "agent",
        text: `Sige, i-remind na lang kita bukas ng umaga. Ang deadline ay ${phDate(sss.nextDue.dueDate)} — huwag mong hayaang mag-penalty.`,
        card: null,
        suggestions: ["Bayaran na lang natin", "Check my SSS contributions"],
      },
    ]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-[14px] font-semibold text-white">SuperAgent</h1>
          <p className="truncate text-[11px] text-white/40">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-egov-green align-middle" />
            4 agencies connected • acting for {USER.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenRail}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-white/65 transition hover:bg-white/5 hover:text-white xl:hidden"
        >
          <PanelRight className="h-3.5 w-3.5" />
          Vault &amp; receipt
        </button>
      </header>

      <ProactiveBanner visible={bannerVisible} onConfirm={confirmPayment} onDefer={deferPayment} />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 eg-scroll sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.map((m) =>
            m.role === "agent" ? (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex gap-3"
              >
                <AgentAvatar />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="inline-block rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-[14.5px] leading-relaxed text-white/85">
                    {m.text}
                  </div>
                  {m.card ? <CardFor kind={m.card} /> : null}
                  {m.suggestions?.length ? (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {m.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => send(s)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/60 transition hover:border-egov-action/50 hover:bg-egov-action/10 hover:text-white"
                        >
                          <Sparkles className="h-3 w-3 text-egov-action" />
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-end gap-3"
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl rounded-br-sm bg-egov-action px-4 py-2.5 text-[14.5px] leading-relaxed text-white",
                    "shadow-[0_10px_30px_-12px_rgba(30,144,255,0.8)]"
                  )}
                >
                  {m.text}
                </div>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-semibold text-white/70">
                  {USER.initials}
                </span>
              </motion.div>
            )
          )}

          <AnimatePresence>{working ? <Working agencies={working} /> : null}</AnimatePresence>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <Composer onSend={send} disabled={working !== null} />
      </div>
    </div>
  );
}
