import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/shell/app-shell";

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

  return (
    <AppShell
      role={session.role}
      name={session.name}
      clientId={session.clientId ?? null}
      emailVerified={emailVerified}
    >
      {children}
    </AppShell>
  );
}
