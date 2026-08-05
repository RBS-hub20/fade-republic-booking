"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * XENA — QuantumX's AI support widget. Premium black + GOLD glassy popup
 * (brand luxury look, not the generic green helpdesk style).
 *
 * The chat LOGIC (streaming replies from /api/support/chat, quick prompts,
 * public vs client mode) is ported verbatim from the previous SupportChat so
 * behaviour is unchanged — this is a UI/skin upgrade + a floating avatar button
 * with a gold glow pulse, an online dot, and a homepage "Ask XENA" hint bubble.
 *
 * Rendered once, globally, from the root layout. It self-manages where it shows
 * (everywhere except /admin and the separate eGov product) and which mode to use
 * based on the route, so callers just drop <XenaWidget /> in.
 */

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Msg = {
  role: "assistant",
  content: "Hi! I'm XENA, your QuantumX support assistant. How can I help you today?",
};
const PUBLIC_GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm XENA 👋 Ask me about QuantumX earnings, how the compensation plan works, or if this is legit. I'm here 24/7!",
};
const QUICK_PROMPTS = ["What is QuantumX?", "How do referrals work?", "What's my balance?", "When will I see profit?"];
const PUBLIC_QUICK_PROMPTS = ["How do I earn?", "Is this legit?", "Minimum deposit?", "Show me comp plan"];

// Routes where XENA should NOT float: the admin console and the separate eGov
// product surface (it has its own agent — a QuantumX sales bot has no business
// over it). Everything else (/, /login, /signup, /dashboard, /wallet, …) shows it.
const HIDE_PREFIXES = ["/admin", "/egov", "/app"];
// Authenticated app routes → account-aware "client" mode (can answer balance etc.).
const CLIENT_PREFIXES = [
  "/dashboard",
  "/wallet",
  "/ledger",
  "/reports",
  "/clients",
  "/approvals",
  "/charts",
  "/qx-tiers",
  "/deposit",
  "/settings",
];

function matchPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Fire an analytics event to whatever provider is present (no-op otherwise). */
function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    gtag?: (...a: unknown[]) => void;
    dataLayer?: unknown[];
    plausible?: (e: string, o?: unknown) => void;
  };
  try {
    w.gtag?.("event", event, params ?? {});
    w.dataLayer?.push({ event, ...(params ?? {}) });
    w.plausible?.(event, params ? { props: params } : undefined);
  } catch {
    /* analytics must never break the UI */
  }
}

/** Circular XENA avatar. Uses the brand face image, falling back to the app
 *  icon if it hasn't been uploaded yet. */
function XenaAvatar({ size, ring = true }: { size: number; ring?: boolean }) {
  const [src, setSrc] = useState("/xena-avatar.png");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="XENA"
      width={size}
      height={size}
      onError={() => setSrc("/icon-192.png")}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
      className={cn("shrink-0 bg-black", ring && "border border-gold-400/50")}
    />
  );
}

/** Gold "XENA is typing…" indicator — a shimmering black/gold bubble with three
 *  glowing gold dots bouncing in sequence. Shown while we wait for the first
 *  chunk from /api/support/chat (before any streamed text arrives). */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <XenaAvatar size={30} />
      <div className="xena-typing-bubble rounded-2xl rounded-bl-sm border bg-black/60 px-3.5 py-2">
        <p className="mb-1 text-[11px] italic text-gold-300">XENA is typing…</p>
        <div className="flex items-center gap-1.5">
          <span className="xena-dot" style={{ animationDelay: "0s" }} />
          <span className="xena-dot" style={{ animationDelay: "0.2s" }} />
          <span className="xena-dot" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    </div>
  );
}

/** Gold sparkle burst — 5 gold stars that pop around a bubble's corners once,
 *  played when a reply finishes streaming. Absolutely positioned inside a
 *  position:relative bubble; purely decorative (pointer-events: none). */
function SparkleBurst() {
  const stars: React.CSSProperties[] = [
    { top: "-8px", right: "-6px", animationDelay: "0s" },
    { top: "-10px", left: "22%", animationDelay: "0.1s" },
    { bottom: "-8px", left: "-6px", animationDelay: "0.2s" },
    { bottom: "-6px", right: "12%", animationDelay: "0.3s" },
    { top: "38%", right: "-10px", animationDelay: "0.15s" },
  ];
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {stars.map((s, i) => (
        <span key={i} className="xena-sparkle" style={s} />
      ))}
    </span>
  );
}

/** Small green "online" presence dot with a soft ping. */
function OnlineDot({ size = 12 }: { size?: number }) {
  return (
    <span className="relative inline-flex" style={{ height: size, width: size }}>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
        style={{ backgroundColor: "#10B981" }}
      />
      <span
        className="relative inline-flex rounded-full border-2 border-black"
        style={{ height: size, width: size, backgroundColor: "#10B981" }}
      />
    </span>
  );
}

export function XenaWidget() {
  const pathname = usePathname() || "/";
  const hidden = matchPrefix(pathname, HIDE_PREFIXES);
  const isPublic = !matchPrefix(pathname, CLIENT_PREFIXES);

  const greeting = isPublic ? PUBLIC_GREETING : GREETING;
  const quickPrompts = isPublic ? PUBLIC_QUICK_PROMPTS : QUICK_PROMPTS;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([greeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  // Finish flourish: index of the bubble that just finished streaming (sparkle +
  // glow), plus a nonce so re-finishing the same index still re-triggers.
  const [finishIdx, setFinishIdx] = useState<number | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const prevStreaming = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the greeting if the mode flips (public ↔ client) while mounted.
  useEffect(() => {
    setMessages((m) => (m.length <= 1 ? [greeting] : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublic]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Homepage nudge: after 5s show a dismissible "Ask XENA" bubble, once per
  // session, and only if the user hasn't already opened the chat.
  useEffect(() => {
    if (pathname !== "/") return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem("qx-xena-hint") === "1";
    } catch {
      /* storage blocked */
    }
    if (dismissed) return;
    const t = setTimeout(() => setShowHint(true), 5000);
    // Auto-retract after a while so it never lingers.
    const t2 = setTimeout(() => setShowHint(false), 15000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [pathname]);

  const dismissHint = () => {
    setShowHint(false);
    try {
      sessionStorage.setItem("qx-xena-hint", "1");
    } catch {
      /* ignore */
    }
  };

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setLoading(true);

    try {
      if (isPublic) track("xena_public_message_sent");
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isPublic ? { message: content, mode: "public" } : { message: content }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      if (!acc.trim()) {
        setMessages((m) => m.slice(0, -1));
        setError("The assistant is having trouble right now. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Waiting for the first chunk (user just sent) → show the gold typing dots.
  // Once the streamed assistant bubble exists → show its text with a gold cursor.
  const awaitingReply = loading && messages[messages.length - 1]?.role === "user";
  const isStreaming = loading && messages[messages.length - 1]?.role === "assistant";

  // Detect the streaming → finished transition and fire the sparkle burst on the
  // completed assistant bubble.
  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      const idx = messages.length - 1;
      if (messages[idx]?.role === "assistant" && messages[idx].content.trim()) {
        setFinishIdx(idx);
        setBurstKey((k) => k + 1);
      }
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, messages]);

  // Clear the flourish after it plays (sparkle 0.8s + delays ≈ 1.1s).
  useEffect(() => {
    if (finishIdx === null) return;
    const t = setTimeout(() => setFinishIdx(null), 1100);
    return () => clearTimeout(t);
  }, [finishIdx, burstKey]);

  const openChat = () => {
    dismissHint();
    setOpen(true);
    if (isPublic) track("xena_public_chat_opened");
  };

  // Hide entirely on admin / eGov. (After all hooks, to keep hook order stable.)
  const shouldRender = useMemo(() => !hidden, [hidden]);
  if (!shouldRender) return null;

  return (
    <>
      {/* Homepage hint bubble */}
      <AnimatePresence>
        {showHint && !open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 right-5 z-50 flex max-w-[220px] items-center gap-2 rounded-2xl rounded-br-sm border border-gold-400/50 bg-black/90 px-3.5 py-2.5 text-sm text-gold-100 shadow-[0_0_24px_rgba(255,215,0,0.35)] backdrop-blur"
          >
            <button onClick={openChat} className="text-left font-medium">
              Need help? <span className="text-gold-300">Ask XENA!</span>
            </button>
            <button
              onClick={dismissHint}
              aria-label="Dismiss"
              className="-mr-1 shrink-0 rounded p-0.5 text-gold-300/70 hover:text-gold-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating avatar button */}
      <button
        onClick={() => (open ? setOpen(false) : openChat())}
        aria-label={open ? "Close XENA support chat" : "Open XENA support chat"}
        className={cn(
          "group fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full",
          "border-[3px] bg-black transition-transform duration-200 hover:scale-110",
          !open && "xena-pulse"
        )}
        style={{ borderColor: "#FFD700" }}
      >
        {open ? (
          <X className="h-7 w-7 text-gold-300" />
        ) : (
          <>
            <XenaAvatar size={56} ring={false} />
            {/* Online dot, top-right */}
            <span className="absolute right-0 top-0">
              <OnlineDot size={13} />
            </span>
          </>
        )}
      </button>

      {/* Chat popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            style={{ transformOrigin: "bottom right" }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden border border-gold-400/30 shadow-2xl shadow-gold-500/20",
              "bg-gradient-to-b from-[#141414] to-[#0A0A0A]",
              // Full-screen on mobile, floating gold panel from sm up.
              "inset-0 h-full w-full rounded-none sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[70vh] sm:max-h-[560px] sm:w-96 sm:rounded-2xl"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-gold-400/20 bg-gradient-to-r from-gold-400/10 to-transparent px-4 py-3">
              <div className="flex items-center gap-3">
                <XenaAvatar size={40} />
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white">
                    XENA <span className="font-medium text-gold-300">— QuantumX Support</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: "#10B981" }}>
                    <OnlineDot size={8} />
                    Online
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="-mr-1 shrink-0 rounded-full p-2 text-gold-300/70 transition-colors hover:bg-gold-400/10 hover:text-gold-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) =>
                m.role === "assistant" ? (
                  <div key={i} className="flex items-end gap-2">
                    <XenaAvatar size={30} />
                    <div
                      className={cn(
                        "relative max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-white/5 bg-white/5 px-3.5 py-2 text-sm text-gray-100",
                        finishIdx === i && "xena-finish-glow"
                      )}
                    >
                      {m.content}
                      {/* Blinking gold cursor while this bubble is still streaming. */}
                      {isStreaming && i === messages.length - 1 && <span className="xena-cursor" />}
                      {/* One-shot gold sparkle burst when this reply finishes. */}
                      {finishIdx === i && <SparkleBurst key={burstKey} />}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-gradient-to-br from-gold-300 to-gold-500 px-3.5 py-2 text-sm font-medium text-black">
                      {m.content}
                    </div>
                  </div>
                )
              )}
              {awaitingReply && <TypingIndicator />}
              {error && (
                <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-1.5 border-t border-gold-400/15 px-3 pt-2.5">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={loading}
                  className="rounded-full border border-gold-400/25 bg-black/40 px-2.5 py-1 text-xs text-gold-200/80 transition-colors hover:border-gold-400/60 hover:text-gold-100 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 pt-2">
              <div className="flex items-end gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={isPublic ? "Ask XENA about QuantumX…" : "Ask XENA about your account…"}
                  maxLength={2000}
                  className="flex-1 rounded-lg border border-gold-400/25 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-gold-400/70"
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold-300 to-gold-500 text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-gray-500">
                AI can make mistakes. Trading involves risk.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
