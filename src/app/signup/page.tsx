"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, Gift } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { REFERRALS_ENABLED } from "@/lib/referrals-config";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = (REFERRALS_ENABLED && searchParams.get("ref")?.trim()) || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<
    { state: "idle" | "checking" | "available" | "taken" | "invalid"; msg?: string }
  >({ state: "idle" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

  function onUsernameChange(v: string) {
    // Force the stored form (lowercase, [a-z0-9_], ≤30) as the user types.
    const clean = v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    setUsername(clean);
    setUStatus({ state: "idle" });
  }

  async function checkUsername() {
    if (!username) return setUStatus({ state: "idle" });
    if (!USERNAME_RE.test(username)) {
      return setUStatus({ state: "invalid", msg: "3–30 chars: a–z, 0–9, _ only." });
    }
    setUStatus({ state: "checking" });
    try {
      const res = await fetch(`/api/auth/username-available?u=${encodeURIComponent(username)}`);
      const data = await res.json().catch(() => ({}));
      if (data.available) setUStatus({ state: "available", msg: "Username available" });
      else setUStatus({ state: "taken", msg: data.reason ?? "Username not available" });
    } catch {
      setUStatus({ state: "idle" });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!USERNAME_RE.test(username)) {
      setError("Please choose a valid username (3–30 chars: a–z, 0–9, _).");
      return;
    }
    if (uStatus.state === "taken") {
      setError("That username is already taken.");
      return;
    }
    if (!gender) {
      setError("Please select your gender.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, username, gender, password, ref }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // Account created but unverified — send them to verify their email.
      router.push(`/auth/verify-pending?email=${encodeURIComponent(data.email ?? email)}`);
    } else {
      setLoading(false);
      setError(data.error ?? "Sign up failed");
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
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Join QuantumX Global Markets — trade beyond limits
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {ref && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2.5 text-sm text-gold-200">
                <Gift className="h-4 w-4 shrink-0" />
                <span>
                  You were invited with code <span className="font-semibold">{ref}</span> — welcome
                  to QuantumX!
                </span>
              </div>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
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
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                  <Input
                    id="username"
                    name="username"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="yourname"
                    className="pl-7"
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    onBlur={checkUsername}
                    required
                  />
                </div>
                {uStatus.state === "checking" && (
                  <p className="text-xs text-muted-foreground">Checking availability…</p>
                )}
                {uStatus.state === "available" && (
                  <p className="text-xs text-profit">✓ {uStatus.msg}</p>
                )}
                {(uStatus.state === "taken" || uStatus.state === "invalid") && (
                  <p className="text-xs text-loss">⚠ {uStatus.msg}</p>
                )}
                {uStatus.state === "idle" && (
                  <p className="text-xs text-muted-foreground">3–30 chars: a–z, 0–9, underscore. You can change it once later.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                        gender === g
                          ? "border-gold-400 bg-gold-400/10 text-gold-200"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Used to pick your profile avatar.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm</Label>
                  <PasswordInput
                    id="confirm"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>

            <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-gold-300 hover:underline">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
