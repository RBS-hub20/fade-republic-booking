"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SESSION_POLICY,
  IDLE_WARN_BEFORE_MS,
  IDLE_WARN_RESPONSE_MS,
  type Role,
} from "@/lib/auth-config";
import { useInactivityPaused } from "@/lib/inactivity";

// Routes where the idle timer is paused and the warning is suppressed — the
// user may be mid-transaction and needs time (copy TXID, upload proof, etc.).
export const SENSITIVE_PREFIXES = [
  "/withdraw",
  "/deposit",
  "/transfer",
  "/wallet",
  "/admin/withdrawals",
];

export function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

async function doLogout(reason: "timeout" | "expired") {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* logout must proceed even if the request fails */
  }
  window.location.href = `/login?reason=${reason}`;
}

export function InactivityGuard({ role, sessionIat }: { role: Role; sessionIat: number | null }) {
  const pathname = usePathname() || "/";
  const storePaused = useInactivityPaused();
  const policy = SESSION_POLICY[role] ?? SESSION_POLICY.client;

  const paused = storePaused || isSensitivePath(pathname);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const lastActivityRef = useRef(Date.now());
  const warnStartRef = useRef<number | null>(null);
  const loggingOutRef = useRef(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(IDLE_WARN_RESPONSE_MS / 1000));

  const hardDeadline = sessionIat ? sessionIat + policy.hardCapMs : null;

  const forceLogout = useCallback((reason: "timeout" | "expired") => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    void doLogout(reason);
  }, []);

  // Track activity — but ignore it while the warning is up (an explicit
  // "Continue" is required) so a stray mousemove can't silently keep a session.
  useEffect(() => {
    const onActivity = () => {
      if (warnStartRef.current !== null) return; // warning showing → require Continue
      lastActivityRef.current = Date.now();
    };
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, { passive: true });
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity);
    };
  }, []);

  // Main 1s tick: hard cap (always), then idle warn / logout (unless paused).
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();

      // Absolute cap — cannot be bypassed by activity or a paused timer.
      if (hardDeadline && now >= hardDeadline) {
        forceLogout("expired");
        return;
      }

      if (pausedRef.current) {
        // Frozen: keep the idle clock "fresh" and dismiss any pending warning.
        lastActivityRef.current = now;
        if (warnStartRef.current !== null) {
          warnStartRef.current = null;
          setWarnOpen(false);
        }
        return;
      }

      const idle = now - lastActivityRef.current;
      if (warnStartRef.current === null) {
        if (idle >= policy.idleMs - IDLE_WARN_BEFORE_MS) {
          warnStartRef.current = now;
          setWarnOpen(true);
          setSecondsLeft(Math.round(IDLE_WARN_RESPONSE_MS / 1000));
        }
      } else {
        const left = IDLE_WARN_RESPONSE_MS - (now - warnStartRef.current);
        setSecondsLeft(Math.max(0, Math.ceil(left / 1000)));
        if (left <= 0) forceLogout("timeout");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [hardDeadline, policy.idleMs, forceLogout]);

  const stayLoggedIn = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) {
        forceLogout("expired");
        return;
      }
    } catch {
      /* keep the user in on a transient network error */
    }
    warnStartRef.current = null;
    lastActivityRef.current = Date.now();
    setWarnOpen(false);
  }, [forceLogout]);

  if (!warnOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gold-400/30 bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-400/15 text-gold-300">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold">Session expiring</h2>
            <p className="text-xs text-muted-foreground">Are you still there?</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          For your security you&apos;ll be signed out in{" "}
          <span className="tnum font-bold text-gold-300">{secondsLeft}s</span> due to inactivity.
        </p>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={stayLoggedIn}>
            Continue
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => forceLogout("timeout")}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
