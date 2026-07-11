import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";
import { WithdrawalsManager, type AdminWithdrawal } from "@/components/admin/withdrawals-manager";
import { isBlobConfigured } from "@/lib/blob";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  let rows: AdminWithdrawal[] = [];
  try {
    await ensureFinanceSchemaOnce(prisma);
    const withdrawals = await prisma.withdrawal.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const clientIds = Array.from(new Set(withdrawals.map((w) => w.clientId).filter(Boolean))) as string[];
    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true, accountNumber: true },
        })
      : [];
    const byId = new Map(clients.map((c) => [c.id, `${c.name} · ${c.accountNumber}`]));
    rows = withdrawals.map((w) => ({
      id: w.id,
      client: w.clientId ? byId.get(w.clientId) ?? "—" : "—",
      amount: w.amount,
      fee: w.fee,
      receiveAmount: w.receiveAmount,
      network: w.network,
      address: w.address,
      status: w.status,
      txHash: w.txHash,
      rejectReason: w.rejectReason,
      createdAt: w.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error("[admin/withdrawals] error:", err);
  }

  const pending = rows.filter((r) => r.status === "pending" || r.status === "processing").length;

  return (
    <>
      <PageHeader
        title="Withdrawals"
        subtitle={`Manual processing · ${pending} awaiting action. Send USDT externally, then record the TX hash.`}
      />
      <WithdrawalsManager rows={rows} blobEnabled={isBlobConfigured()} />
    </>
  );
}
