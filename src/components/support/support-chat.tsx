"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Msg = {
  role: "assistant",
  content: "Hi! I'm XENA, your QuantumX support assistant. How can I help you today?",
};

const QUICK_PROMPTS = [
  "What is QuantumX?",
  "How do referrals work?",
  "What's my balance?",
  "When will I see profit?",
];

/** Circular, cropped avatar (square source → circle via object-fit: cover). */
function XenaAvatar({ size }: { size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/xena-avatar.png"
      alt="XENA"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
      className="shrink-0 border border-gold-400/40 bg-black"
    />
  );
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setLoading(true);

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Stream the assistant reply token-by-token.
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
        setMessages((m) => m.slice(0, -1)); // drop the empty bubble
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

  const awaitingReply = loading && messages[messages.length - 1]?.role === "user";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-gold-300 to-gold-500 text-black shadow-lg shadow-gold-500/30",
          "transition-transform hover:scale-105 active:scale-95"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-5 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
            "h-[70vh] max-h-[560px] w-[calc(100vw-2.5rem)] sm:w-96"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-background/60 px-4 py-3">
            <XenaAvatar size={40} />
            <div className="leading-tight">
              <p className="text-base font-bold text-white">XENA</p>
              <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#10B981" }}>
                <span className="relative inline-flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                    style={{ backgroundColor: "#10B981" }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#10B981" }}
                  />
                </span>
                Online
              </p>
              <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                QuantumX Support Agent
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) =>
              m.role === "assistant" ? (
                <div key={i} className="flex items-end gap-2">
                  <XenaAvatar size={32} />
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-foreground">
                    {m.content || (awaitingReply && i === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-gold-400 px-3.5 py-2 text-sm text-black">
                    {m.content}
                  </div>
                </div>
              )
            )}
            {awaitingReply && (
              <div className="flex items-end gap-2">
                <XenaAvatar size={32} />
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> XENA is typing…
                </div>
              </div>
            )}
            {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-xs text-loss">{error}</p>}
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1.5 border-t border-border px-3 pt-2.5">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-gold-400/50 hover:text-gold-200 disabled:opacity-50"
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
                placeholder="Ask XENA about your account…"
                maxLength={2000}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-400/60"
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-400 text-black transition-colors hover:bg-gold-300 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              AI can make mistakes. Trading involves risk.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
