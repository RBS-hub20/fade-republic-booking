import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyWithdrawalCompleted, notifyWithdrawalRejected } from "@/lib/mailers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: process a withdrawal. MANUAL flow — the admin sends USDT from an
 * external wallet, then records the on-chain TX hash here (approve) or rejects
 * with a reason (which auto-refunds, since rejected requests leave the pool).
 * The platform never sends funds automatically.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const w = await prisma.withdrawal.findUnique({ where: { id: params.id } });
    if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (w.status === "completed" || w.status === "rejected") {
      return NextResponse.json({ error: "This withdrawal is already finalized." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    const client = w.clientId
      ? await prisma.client.findUnique({ where: { id: w.clientId }, select: { name: true, email: true } })
      : null;

    if (action === "approve") {
      const txHash = String(body?.txHash || "").trim();
      if (!txHash) {
        return NextResponse.json({ error: "Transaction hash is required." }, { status: 400 });
      }
      const updated = await prisma.withdrawal.update({
        where: { id: w.id },
        data: {
          status: "completed",
          txHash,
          processedAt: new Date(),
          adminId: session.userId ?? null,
        },
      });
      if (client) {
        notifyWithdrawalCompleted({
          email: client.email,
          name: client.name,
          amount: w.amount,
          fee: w.fee,
          receiveAmount: w.receiveAmount,
          network: w.network,
          address: w.address,
          txHash,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, withdrawal: updated });
    }

    if (action === "reject") {
      const reason = String(body?.reason || "").trim();
      if (!reason) {
        return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
      }
      const updated = await prisma.withdrawal.update({
        where: { id: w.id },
        data: {
          status: "rejected",
          rejectReason: reason,
          processedAt: new Date(),
          adminId: session.userId ?? null,
        },
      });
      if (client) {
        notifyWithdrawalRejected({
          email: client.email,
          name: client.name,
          amount: w.amount,
          reason,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, withdrawal: updated });
    }

    if (action === "processing") {
      const updated = await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: "processing" },
      });
      return NextResponse.json({ ok: true, withdrawal: updated });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("[withdrawals PATCH] error:", err);
    return NextResponse.json({ error: "Failed to update withdrawal." }, { status: 500 });
  }
}
