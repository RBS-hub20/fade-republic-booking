"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import {
  checkPassword,
  passwordMeetsPolicy,
  passwordStrength,
  PASSWORD_RULE_LABELS,
} from "@/lib/password-strength";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const checks = checkPassword(next);
  const strength = passwordStrength(next);
  const confirmMismatch = confirm.length > 0 && confirm !== next;
  const canSubmit =
    current.length > 0 && passwordMeetsPolicy(next) && confirm === next && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordMeetsPolicy(next)) {
      setError("Your new password doesn't meet the requirements below.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not change your password.");
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-profit" />
          <div>
            <p className="font-medium">Password updated</p>
            <p className="text-sm text-muted-foreground">
              Your password has been changed and a confirmation email was sent.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const toneBar = { loss: "bg-loss", gold: "bg-gold-400", profit: "bg-profit" }[strength.tone];
  const toneText = { loss: "text-loss", gold: "text-gold-300", profit: "text-profit" }[strength.tone];

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="max-w-md space-y-4" autoComplete="off">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />

            {next.length > 0 && (
              <div className="space-y-2 pt-1">
                {/* Strength meter */}
                <div className="flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-full flex-1 rounded-full",
                          i < strength.score ? toneBar : "bg-secondary"
                        )}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <span className={cn("w-12 text-right text-xs font-medium", toneText)}>
                      {strength.label}
                    </span>
                  )}
                </div>
                {/* Rule checklist */}
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {PASSWORD_RULE_LABELS.map(({ key, label }) => {
                    const met = checks[key];
                    return (
                      <li
                        key={key}
                        className={cn(
                          "flex items-center gap-1.5 text-xs",
                          met ? "text-profit" : "text-muted-foreground"
                        )}
                      >
                        {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {confirmMismatch && <p className="text-xs text-loss">Passwords do not match.</p>}
          </div>

          {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

          <Button type="submit" disabled={!canSubmit}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
