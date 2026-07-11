"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function UsernameClaimForm({
  currentUsername,
  locked,
}: {
  currentUsername: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(currentUsername ?? "");
  const [status, setStatus] = useState<
    { state: "idle" | "checking" | "available" | "taken" | "invalid"; msg?: string }
  >({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onChange(v: string) {
    setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30));
    setStatus({ state: "idle" });
    setError(null);
  }

  async function check() {
    if (!username || username === currentUsername) return;
    if (!USERNAME_RE.test(username)) return setStatus({ state: "invalid", msg: "3–30 chars: a–z, 0–9, _ only." });
    setStatus({ state: "checking" });
    try {
      const res = await fetch(`/api/auth/username-available?u=${encodeURIComponent(username)}`);
      const d = await res.json().catch(() => ({}));
      setStatus(d.available ? { state: "available", msg: "Available" } : { state: "taken", msg: d.reason ?? "Not available" });
    } catch {
      setStatus({ state: "idle" });
    }
  }

  async function save() {
    if (!USERNAME_RE.test(username)) return setError("Please choose a valid username.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not set username.");
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Could not set username.");
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm">
              Your username is <span className="font-semibold text-gold-300">@{currentUsername}</span>.
            </p>
            <p className="text-xs text-muted-foreground">This is permanent and can no longer be changed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md">
      <CardContent className="space-y-4 py-6">
        <div className="space-y-1.5">
          <Label htmlFor="u">Choose your @username</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              id="u"
              value={username}
              onChange={(e) => onChange(e.target.value)}
              onBlur={check}
              className="pl-7"
              placeholder="yourname"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          {status.state === "checking" && <p className="text-xs text-muted-foreground">Checking…</p>}
          {status.state === "available" && <p className="text-xs text-profit">✓ {status.msg}</p>}
          {(status.state === "taken" || status.state === "invalid") && <p className="text-xs text-loss">⚠ {status.msg}</p>}
          <p className="text-xs text-muted-foreground">
            ⚠️ You can set this <strong>once</strong> — choose carefully. It won&apos;t affect your referral code.
          </p>
        </div>
        {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}
        {done ? (
          <p className="flex items-center gap-1.5 text-sm text-profit">
            <Check className="h-4 w-4" /> Username set to @{username}.
          </p>
        ) : (
          <Button onClick={save} disabled={busy || status.state === "taken" || !USERNAME_RE.test(username)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Claim @{username || "username"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
