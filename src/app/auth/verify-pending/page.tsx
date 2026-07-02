"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck, Loader2, ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const COOLDOWN = 60;

function VerifyPending() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  // Countdown timer for the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function resend() {
    if (cooldown > 0 || sending || !email) return;
    setSending(true);
    setMsg(null);
    setDevLink(null);
    const res = await fetch("/api/auth/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      setCooldown(COOLDOWN);
      setMsg("Verification email sent. Check your inbox and spam.");
      if (data.devLink) setDevLink(data.devLink);
    } else {
      setMsg(data.error ?? "Could not resend. Please try again.");
    }
  }

  return (
    <div className="w-full max-w-md">
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>

      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size="lg" className="mb-3 rounded-xl" />
        <h1 className="text-2xl font-bold tracking-tight">Verify your QuantumX email</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/15 text-gold-300">
            <MailCheck className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              "your email"
            )}
            . Click the link in that email to activate your account.
          </p>
          <p className="text-xs text-muted-foreground">
            Can&apos;t find it? Check your spam folder, or resend below.
          </p>

          <Button className="w-full" onClick={resend} disabled={sending || cooldown > 0 || !email}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
          </Button>

          {msg && <p className="text-sm text-profit">{msg}</p>}
          {devLink && (
            <div className="rounded-md border border-border bg-secondary/40 p-3 text-left">
              <p className="mb-1 text-xs text-muted-foreground">
                Email provider not configured — use this link:
              </p>
              <a href={devLink} className="break-all font-mono text-xs text-gold-300 underline">
                {devLink}
              </a>
            </div>
          )}

          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            Already verified?{" "}
            <Link href="/login" className="font-medium text-gold-300 hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPendingPage() {
  return (
    <main className="terminal-bg flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}>
        <VerifyPending />
      </Suspense>
    </main>
  );
}
