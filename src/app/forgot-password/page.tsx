"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setSent(true);
      if (data.devLink) setDevLink(data.devLink);
    } else {
      setError(data.error ?? "Something went wrong");
    }
  }

  return (
    <main className="terminal-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>

        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark size="lg" className="mb-3 rounded-xl" />
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {sent ? (
              <div className="space-y-4 text-center">
                <p className="rounded-md bg-profit/10 px-3 py-3 text-sm text-profit">
                  If an account exists for that email, a reset link has been sent.
                </p>
                {devLink && (
                  <div className="rounded-md border border-border bg-secondary/40 p-3 text-left">
                    <p className="mb-1 text-xs text-muted-foreground">
                      Email provider not configured — use this link:
                    </p>
                    <a href={devLink} className="break-all text-xs font-mono text-gold-300 underline">
                      {devLink}
                    </a>
                  </div>
                )}
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">Return to login</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
