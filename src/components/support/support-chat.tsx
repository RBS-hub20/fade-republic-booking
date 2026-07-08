"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm your QuantumX assistant. Ask me about your balance, performance, deposits, tiers, or referral earnings.",
};

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

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
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
          <div className="flex items-center gap-2 border-b border-border bg-background/60 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400/15 text-gold-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">QuantumX Support</p>
              <p className="text-[11px] text-muted-foreground">AI assistant · your account</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-gold-400 text-black"
                      : "rounded-bl-sm bg-secondary text-foreground"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            {error && (
              <p className="rounded-md bg-loss/10 px-3 py-2 text-xs text-loss">{error}</p>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about your account…"
                maxLength={2000}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-400/60"
              />
              <button
                onClick={send}
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
