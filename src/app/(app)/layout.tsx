import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientPerformance } from "@/lib/data";
import { tierForBalance } from "@/lib/tiers";
import { AppShell, type HeaderTier } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");

  // Verification status drives the "verify your email" banner.
  let emailVerified = true;
  if (session.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { emailVerified: true },
    });
    emailVerified = user?.emailVerified ?? true;
  }

  // Header tier chip (clients only) — derived from the account balance.
  let tier: HeaderTier | null = null;
  if (session.role === "client" && session.clientId) {
    const perf = await getClientPerformance(session.clientId);
    const t = tierForBalance(perf?.kpis.currentBalance ?? 0);
    tier = t ? { name: t.name, monogram: t.monogram, accent: t.accent } : null;
  }

  return (
    <AppShell
      role={session.role}
      name={session.name}
      clientId={session.clientId ?? null}
      emailVerified={emailVerified}
      tier={tier}
    >
      {children}
    </AppShell>
  );
}
