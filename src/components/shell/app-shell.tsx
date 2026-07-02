"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { VerifyBanner } from "./verify-banner";

export function AppShell({
  role,
  name,
  clientId,
  emailVerified,
  children,
}: {
  role: string;
  name: string;
  clientId: string | null;
  emailVerified: boolean;
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
        <Topbar onMenu={() => setSidebarOpen(true)} role={role} name={name} />
        {!emailVerified && <VerifyBanner />}
        <main className="terminal-bg flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
