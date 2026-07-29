import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ApprovalsView } from "@/components/approvals/approvals-view";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleDeposits } from "@/lib/deposit-expiry";
import { toManilaDateKey } from "@/lib/performance";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  // Sweep abandoned (no-TxHash, >30min) deposits to EXPIRED so they never
  // clutter the pending queue below. Best-effort; never blocks the page.
  await expireStaleDeposits().catch(() => {});

  const rows = await prisma.transaction.findMany({
    where: { status: "PENDING" },
    orderBy: { date: "desc" },
    include: { client: { select: { name: true, accountNumber: true } } },
  });

  const pending = rows.map((t) => ({
    id: t.id,
    date: toManilaDateKey(t.date),
    type: t.type as "DEPOSIT" | "WITHDRAWAL",
    amount: t.amount,
    method: t.method as any,
    notes: t.notes,
    client: t.client,
  }));

  // Recently auto-expired deposits — visible in the Expired tab (audit), never
  // in the pending queue. Bounded so the page stays fast.
  const expiredRows = await prisma.transaction.findMany({
    where: { status: "EXPIRED", type: "DEPOSIT" },
    orderBy: { date: "desc" },
    take: 50,
    include: { client: { select: { name: true, accountNumber: true } } },
  });
  const expired = expiredRows.map((t) => ({
    id: t.id,
    date: toManilaDateKey(t.date),
    type: t.type as "DEPOSIT" | "WITHDRAWAL",
    amount: t.amount,
    method: t.method as any,
    notes: t.notes,
    client: t.client,
  }));

  return (
    <>
      <PageHeader title="Approvals" subtitle="Review client deposit & withdrawal requests">
        {pending.length > 0 && (
          <Badge variant="warning">{pending.length} pending</Badge>
        )}
      </PageHeader>
      <ApprovalsView pending={pending} expired={expired} />
    </>
  );
}
