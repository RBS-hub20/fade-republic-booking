"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CandlestickChart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { DEMO_CREDENTIALS } from "@/lib/auth-config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@rscryptofx.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    }
  }

  return (
    <main className="terminal-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gold-400 text-black">
            <CandlestickChart className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            RSCrypto<span className="text-gold-400">FX</span>
          </h1>
          <p className="text-sm text-muted-foreground">Client Portal · PAMM Reporting</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Demo accounts (click to fill)
              </p>
              <div className="flex gap-2">
                {DEMO_CREDENTIALS.map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => {
                      setEmail(c.email);
                      setPassword(c.password);
                    }}
                    className="flex-1 rounded-md border border-border bg-secondary/50 px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                  >
                    <span className="block font-semibold text-foreground">{c.label}</span>
                    <span className="block truncate text-muted-foreground">{c.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo environment · Not financial advice
        </p>
      </div>
    </main>
  );
}
