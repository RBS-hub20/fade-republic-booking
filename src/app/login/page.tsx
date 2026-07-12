"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ShieldAlert } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Surface why the user landed here (idle timeout / hard session cap). Read
  // from location (not useSearchParams) to avoid a Suspense boundary at build.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "timeout") setNotice("You were signed out due to inactivity. Please log in again.");
    else if (reason === "expired") setNotice("Your session reached its time limit. Please log in again.");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      router.push(typeof data.redirectTo === "string" ? data.redirectTo : "/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      if (data.unverified) {
        setUnverified(data.email ?? email);
      } else {
        setError(data.error ?? "Login failed");
      }
    }
  }

  return (
    <main className="terminal-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark size="lg" className="mb-3 rounded-xl" />
          <h1 className="text-2xl font-bold tracking-tight">
            Quantum<span className="text-gold-400">X</span> Global Markets
          </h1>
          <p className="text-sm text-muted-foreground">Trade Beyond Limits.</p>
        </div>

        {notice && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2.5 text-sm text-gold-200">
            <ShieldAlert className="h-4 w-4 shrink-0" /> {notice}
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            {/* autoComplete=off + honeypot discourages the browser from filling credentials */}
            <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
              <input type="text" name="prevent_autofill" className="hidden" autoComplete="off" tabIndex={-1} aria-hidden />
              <div className="space-y-1.5">
                <Label htmlFor="email">Email or username</Label>
                <Input
                  id="email"
                  name="login-email"
                  type="text"
                  inputMode="email"
                  placeholder="Email or username"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-gold-300 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  name="login-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
              )}

              {unverified && (
                <div className="rounded-md border border-gold-400/30 bg-gold-400/10 px-3 py-2.5 text-sm">
                  <p className="font-medium text-gold-200">Please verify your email first.</p>
                  <p className="mt-0.5 text-muted-foreground">
                    We sent a link to <span className="text-foreground">{unverified}</span>. Check
                    your inbox and spam.
                  </p>
                  <Link
                    href={`/auth/verify-pending?email=${encodeURIComponent(unverified)}`}
                    className="mt-1 inline-block font-medium text-gold-300 hover:underline"
                  >
                    Resend verification email →
                  </Link>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link href="/signup" className="font-medium text-gold-300 hover:underline">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
