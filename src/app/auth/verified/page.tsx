"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function Verified() {
  const params = useSearchParams();
  const status = params.get("status") ?? "invalid";
  const email = params.get("email") ?? "";

  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function resend() {
    if (!email || sending) return;
    setSending(true);
    setMsg(null);
    const res = await fetch("/api/auth/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      setMsg("A new verification email has been sent.");
      if (data.devLink) setDevLink(data.devLink);
    } else {
      setMsg(data.error ?? "Could not resend.");
    }
  }

  const config = {
    success: {
      icon: <CheckCircle2 className="h-7 w-7" />,
      tone: "bg-profit/15 text-profit",
      title: "Email verified!",
      body: "Your QuantumX account is now active. You can sign in and start trading beyond limits.",
    },
    expired: {
      icon: <Clock className="h-7 w-7" />,
      tone: "bg-gold-400/15 text-gold-300",
      title: "Link expired",
      body: "This verification link has expired. Request a fresh one below.",
    },
    invalid: {
      icon: <XCircle className="h-7 w-7" />,
      tone: "bg-loss/15 text-loss",
      title: "Invalid link",
      body: "This verification link is invalid or has already been used. Try logging in, or request a new link.",
    },
  }[status] ?? {
    icon: <XCircle className="h-7 w-7" />,
    tone: "bg-loss/15 text-loss",
    title: "Invalid link",
    body: "This verification link is invalid.",
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size="lg" className="mb-3 rounded-xl" />
        <h1 className="text-lg font-semibold text-muted-foreground">QuantumX Global Markets</h1>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6 text-center">
          <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${config.tone}`}>
            {config.icon}
          </span>
          <div>
            <h2 className="text-xl font-bold">{config.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{config.body}</p>
          </div>

          {status === "success" ? (
            <Button asChild className="w-full">
              <Link href="/login">Continue to Login</Link>
            </Button>
          ) : email ? (
            <>
              <Button className="w-full" onClick={resend} disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Resend verification email
              </Button>
              {msg && <p className="text-sm text-profit">{msg}</p>}
              {devLink && (
                <div className="rounded-md border border-border bg-secondary/40 p-3 text-left">
                  <p className="mb-1 text-xs text-muted-foreground">Dev link:</p>
                  <a href={devLink} className="break-all font-mono text-xs text-gold-300 underline">
                    {devLink}
                  </a>
                </div>
              )}
            </>
          ) : (
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to login</Link>
            </Button>
          )}

          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-gold-300 hover:underline">
              Go to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifiedPage() {
  return (
    <main className="terminal-bg flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}>
        <Verified />
      </Suspense>
    </main>
  );
}
