import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseTxHash } from "@/lib/chain";
import { verifyPendingDeposits } from "@/lib/verify-deposits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Attach a transaction hash to the caller's own PENDING deposit, then attempt
 * immediate verification. Enables "instant confirmation" from the payment screen.
 */
export async function POST(req: Request) {
  const session = getSession();
  if (!session?.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, txHash } = await req.json().catch(() => ({}));
  if (!id || !txHash) {
    return NextResponse.json({ error: "id and txHash are required" }, { status: 400 });
  }

  const clean = String(txHash).trim().slice(0, 120);
  if (!/^[A-Za-z0-9x]{10,120}$/.test(clean)) {
    return NextResponse.json({ error: "That doesn't look like a valid transaction hash." }, { status: 400 });
  }

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.clientId !== session.clientId || tx.type !== "DEPOSIT") {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }
  if (tx.status !== "PENDING") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // Append the TxHash if not already present.
  if (!parseTxHash(tx.notes)) {
    const notes = `${tx.notes ? `${tx.notes} · ` : ""}TxHash: ${clean}`.slice(0, 500);
    await prisma.transaction.update({ where: { id }, data: { notes } });
  }

  // Try to verify right away (best-effort).
  await verifyPendingDeposits({ clientId: session.clientId }).catch(() => {});

  return NextResponse.json({ ok: true });
}
