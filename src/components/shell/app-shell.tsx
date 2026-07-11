"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { VerifyBanner } from "./verify-banner";
import { InactivityGuard } from "@/components/security/inactivity-guard";
import type { Role } from "@/lib/auth-config";

/** Compact tier descriptor shown in the header (clients only). */
export type HeaderTier = { name: string; monogram: string; accent: string };

export function AppShell({
  role,
  name,
  clientId,
  emailVerified,
  tier,
  sessionIat,
  children,
}: {
  role: string;
  name: string;
  clientId: string | null;
  emailVerified: boolean;
  tier?: HeaderTier | null;
  sessionIat: number | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        clientId={clientId}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          role={role}
          name={name}
          emailVerified={emailVerified}
          tier={tier ?? null}
          sessionIat={sessionIat}
        />
        {!emailVerified && <VerifyBanner />}
        <main className="terminal-bg flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <InactivityGuard role={(role as Role) === "admin" ? "admin" : "client"} sessionIat={sessionIat} />
    </div>
  );
}
