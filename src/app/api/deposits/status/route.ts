import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { verifyPendingDeposits } from "@/lib/verify-deposits";
import { parseTxHash } from "@/lib/chain";
import { enforce } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type DepositState = "waiting" | "confirming" | "credited" | "failed";

function stateOf(t: { status: string; notes: string | null }): DepositState {
  if (t.status === "APPROVED") return "credited";
  if (t.status === "REJECTED") return "failed";
  return parseTxHash(t.notes) ? "confirming" : "waiting";
}

/**
 * Poll endpoint for the deposit "waiting for confirmation" flow.
 * Runs the caller's own on-chain verification (auto-approve + email), then
 * returns their recent deposits with a UI state. Client-scoped + rate-limited.
 */
export async function GET(req: Request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.clientId) return NextResponse.json({ error: "No trading account" }, { status: 400 });

  // 12 polls / minute per IP (client polls ~every 15s).
  const limited = enforce(req, "depstatus", 12, 60_000);
  if (limited) return limited;

  // Best-effort: verify this client's pending deposits on-chain.
  await verifyPendingDeposits({ clientId: session.clientId }).catch(() => {});

  const deposits = await prisma.transaction.findMany({
    where: { clientId: session.clientId, type: "DEPOSIT" },
    orderBy: { date: "desc" },
    take: 25,
  });

  return NextResponse.json({
    deposits: deposits.map((d) => ({
      id: d.id,
      amount: d.amount,
      method: d.method,
      createdAt: d.date,
      state: stateOf(d),
    })),
  });
}
