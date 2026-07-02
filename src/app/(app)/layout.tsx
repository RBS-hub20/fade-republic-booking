import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");

  return (
    <AppShell
      role={session.role}
      name={session.name}
      clientId={session.clientId ?? null}
    >
      {children}
    </AppShell>
  );
}
