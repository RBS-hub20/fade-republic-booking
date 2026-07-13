import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientPerformance } from "@/lib/data";
import { tierForBalance } from "@/lib/tiers";
import { AppShell, type HeaderTier } from "@/components/shell/app-shell";
import { ensureReferralSchemaOnce } from "@/lib/referral-schema";
import { ensureUsernameSchemaOnce, ensureUsernamesBackfilledOnce } from "@/lib/username";
import { ensureAvatarSchemaOnce } from "@/lib/avatar";
import { ensurePhoneSchemaOnce } from "@/lib/phone";
import { ensureAvatarsBackfilledOnce } from "@/lib/genealogy-tree";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");

  // Provision any lagging columns (referral / username / avatar) over the live
  // DB before rendering any authed page — this is the shared entry point, so it
  // guarantees the schema for users whose old session skipped the login/signup
  // self-heal. Best-effort: a hiccup here must never take the app down.
  try {
    await Promise.all([
      ensureReferralSchemaOnce(prisma).catch(() => {}),
      ensureUsernameSchemaOnce(prisma).catch(() => {}),
      ensureAvatarSchemaOnce(prisma).catch(() => {}),
      ensurePhoneSchemaOnce(prisma).catch(() => {}),
    ]);
  } catch {
    /* ignore — the queries below are all guarded too */
  }
  // Fill username/avatar for existing users (once per process, fire-and-forget).
  void ensureUsernamesBackfilledOnce();
  void ensureAvatarsBackfilledOnce();

  // Verification status drives the "verify your email" banner.
  let emailVerified = true;
  try {
    if (session.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { emailVerified: true },
      });
      emailVerified = user?.emailVerified ?? true;
    }
  } catch {
    emailVerified = true; // never block the app on this lookup
  }

  // Header tier chip (clients only) — derived from the account balance.
  let tier: HeaderTier | null = null;
  try {
    if (session.role === "client" && session.clientId) {
      const perf = await getClientPerformance(session.clientId);
      const t = tierForBalance(perf?.kpis.currentBalance ?? 0);
      tier = t ? { name: t.name, monogram: t.monogram, accent: t.accent } : null;
    }
  } catch {
    tier = null; // header chip is cosmetic — never crash the shell
  }

  return (
    <AppShell
      role={session.role}
      name={session.name}
      clientId={session.clientId ?? null}
      emailVerified={emailVerified}
      tier={tier}
      sessionIat={session.iat ?? null}
    >
      {children}
    </AppShell>
  );
}
