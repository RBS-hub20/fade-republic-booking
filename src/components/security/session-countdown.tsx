"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock, Lock } from "lucide-react";
import { SESSION_POLICY, type Role } from "@/lib/auth-config";
import { useInactivityPaused } from "@/lib/inactivity";
import { isSensitivePath } from "./inactivity-guard";

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Navbar "Session: 1h 23m remaining" — swaps to a lock badge during a
 *  protected transaction (sensitive route or an open modal/upload). */
export function SessionCountdown({ role, sessionIat }: { role: Role; sessionIat: number | null }) {
  const pathname = usePathname() || "/";
  const paused = useInactivityPaused() || isSensitivePath(pathname);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (paused) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-2.5 py-1 text-xs font-medium text-gold-200 sm:inline-flex">
        <Lock className="h-3.5 w-3.5" /> Session protected during transaction
      </span>
    );
  }

  if (!sessionIat) return null; // legacy session without a known start
  const remaining = sessionIat + SESSION_POLICY[role].hardCapMs - now;
  if (remaining <= 0) return null;

  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex"
      title="Time until this session's absolute limit"
    >
      <Clock className="h-3.5 w-3.5" />
      Session: <span className="tnum font-medium text-foreground">{fmt(remaining)}</span> remaining
    </span>
  );
}
