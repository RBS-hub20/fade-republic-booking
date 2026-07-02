"use client";

import { useState } from "react";
import { KeyRound, Loader2, Copy, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Admin-only: set or reset the login password for a client's account.
 * Provisions a login if the client doesn't have one yet.
 */
export function SetPasswordDialog({
  clientId,
  clientEmail,
}: {
  clientId: string;
  clientEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; generated?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setPassword("");
    setError(null);
    setResult(null);
    setCopied(false);
  }

  async function submit(e: React.FormEvent, generate: boolean) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(generate ? {} : { password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setResult({ email: data.email, generated: data.generatedPassword });
    } else {
      setError(data.error ?? "Failed to set password");
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <KeyRound className="h-4 w-4" /> Set Password
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Set Login Password"
        description={`Login email: ${clientEmail}`}
      >
        {result ? (
          <div className="space-y-4">
            <p className="rounded-md bg-profit/10 px-3 py-2 text-sm text-profit">
              Password updated for {result.email}.
            </p>
            {result.generated && (
              <div className="rounded-md border border-gold-400/30 bg-gold-400/10 p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Share this password securely — it won&apos;t be shown again:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm text-gold-200">
                    {result.generated}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard?.writeText(result.generated!);
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => submit(e, false)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newpw">New password</Label>
              <Input
                id="newpw"
                type="text"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank and click “Generate” for a strong random password.
              </p>
            </div>

            {error && <p className="rounded-md bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => submit(e as any, true)}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate
              </Button>
              <Button type="submit" disabled={loading || password.length < 6}>
                Set password
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
