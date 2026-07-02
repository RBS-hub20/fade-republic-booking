import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ApprovalsView } from "@/components/approvals/approvals-view";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toManilaDateKey } from "@/lib/performance";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

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

  return (
    <>
      <PageHeader title="Approvals" subtitle="Review client deposit & withdrawal requests">
        {pending.length > 0 && (
          <Badge variant="warning">{pending.length} pending</Badge>
        )}
      </PageHeader>
      <ApprovalsView pending={pending} />
    </>
  );
}
