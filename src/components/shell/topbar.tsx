"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, LogOut, Clock, BadgeCheck, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HeaderTier } from "./app-shell";

export function Topbar({
  onMenu,
  role,
  name,
  emailVerified,
  tier,
}: {
  onMenu: () => void;
  role: string;
  name: string;
  emailVerified: boolean;
  tier?: HeaderTier | null;
}) {
  const router = useRouter();
  const [clock, setClock] = useState("");

  // Live Manila clock in the header.
  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
      <button onClick={onMenu} className="text-muted-foreground lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
        <Clock className="h-4 w-4" />
        <span className="tnum font-mono">{clock}</span>
        <span className="text-xs">PHT</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Current tier (clients only) — shows the active package or an Upgrade nudge. */}
        {role === "client" &&
          (tier ? (
            <Link
              href="/qx-tiers"
              title={`Current tier: ${tier.name}`}
              className="hidden items-center gap-1.5 rounded-full border border-gold-400/40 bg-gold-400/10 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-gold-400/20 sm:inline-flex"
            >
              <span className={cn("flex h-4 w-4 items-center justify-center rounded-full bg-black/40 text-[10px] font-bold", tier.accent)}>
                {tier.monogram}
              </span>
              <span className="text-muted-foreground">Tier:</span>
              <span className="font-semibold text-gold-200">{tier.name}</span>
            </Link>
          ) : (
            <Link
              href="/qx-tiers"
              title="Choose a QX tier"
              className="hidden items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-gold-400/40 hover:text-gold-200 sm:inline-flex"
            >
              <span>Current Tier: None</span>
              <span className="font-semibold text-gold-300">· Upgrade</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          ))}
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground capitalize">{role}</p>
        </div>
        {emailVerified && (
          <Badge
            variant="success"
            className="hidden items-center gap-1 sm:inline-flex"
            title="Email verified"
          >
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </Badge>
        )}
        <Badge variant={role === "admin" ? "gold" : "outline"} className="capitalize">
          {role}
        </Badge>
        <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
