"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Paperclip } from "lucide-react";

const PLACEHOLDER = "Utusan mo ako... 'check my sss contributions' (Taglish ok)";

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line — chat convention.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
      <div className="eg-panel flex items-end gap-2 rounded-2xl px-3 py-2.5 transition focus-within:border-egov-action/50 focus-within:shadow-[0_0_0_3px_rgba(30,144,255,0.12)]">
        <button
          type="button"
          aria-label="Attach a document to the vault"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/70 sm:flex"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER}
          aria-label="Message SuperAgent"
          className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[14.5px] leading-relaxed text-white placeholder:text-white/30 focus:outline-none eg-scroll"
        />

        <button
          type="button"
          aria-label="Voice input"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/70 sm:flex"
        >
          <Mic className="h-4 w-4" />
        </button>

        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-egov-action px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#3ba0ff] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
        >
          Send
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 px-1 text-[10.5px] text-white/25">
        MVP build — SSS, PhilHealth, Pag-IBIG at PSA lang muna, at mock data ang lahat ng sagot.
      </p>
    </form>
  );
}
