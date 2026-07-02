"use client";

import { useState } from "react";
import { MailWarning, Loader2, X } from "lucide-react";

/** Dismissible banner prompting an unverified user to verify their email. */
export function VerifyBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  if (dismissed) return null;

  async function resend() {
    setSending(true);
    setMsg(null);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (data.devLink) {
      setDevLink(data.devLink);
      setMsg("Email provider not configured — use this link to verify:");
    } else {
      setMsg("Verification email sent. Check your inbox.");
    }
  }

  return (
    <div className="border-b border-gold-400/30 bg-gold-400/10 px-4 py-2.5 text-sm lg:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <MailWarning className="h-4 w-4 shrink-0 text-gold-300" />
        <span className="text-gold-200">
          Please verify your email address to secure your account.
        </span>
        <button
          onClick={resend}
          disabled={sending}
          className="inline-flex items-center gap-1 font-medium text-gold-300 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Resend verification
        </button>
        {msg && <span className="text-muted-foreground">{msg}</span>}
        {devLink && (
          <a href={devLink} className="break-all font-mono text-xs text-gold-300 underline">
            {devLink}
          </a>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
