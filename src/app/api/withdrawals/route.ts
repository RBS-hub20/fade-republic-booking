import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";
import {
  getCapitalSummary,
  isValidPayoutAddress,
  computeFee,
  MIN_WITHDRAWAL,
} from "@/lib/capital";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORKS = ["USDT_BEP20", "USDT_TRC20"];

/** List the signed-in client's own withdrawal requests (newest first). */
export async function GET() {
  const session = getSession();
  if (!session?.userId || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureFinanceSchemaOnce(prisma);
    const rows = await prisma.withdrawal.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[withdrawals GET] error:", err);
    return NextResponse.json([]);
  }
}

/** Request an earnings withdrawal from the Available Withdrawal pool. */
export async function POST(req: Request) {
  const session = getSession();
  if (!session?.userId || session.role !== "client" || !session.clientId) {
    return NextResponse.json({ error: "Sign in as a client to withdraw." }, { status: 401 });
  }
  const userId = session.userId;
  const clientId = session.clientId;

  try {
    await ensureFinanceSchemaOnce(prisma);

    const body = await req.json().catch(() => ({}));
    const amount = Math.round(Number(body?.amount) * 100) / 100;
    const network = String(body?.network || "");
    const address = String(body?.address || "").trim();

    if (!NETWORKS.includes(network)) {
      return NextResponse.json({ error: "Choose a valid network." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: `Minimum withdrawal is $${MIN_WITHDRAWAL.toFixed(2)}.` },
        { status: 400 }
      );
    }
    if (!isValidPayoutAddress(network, address)) {
      return NextResponse.json(
        { error: `That doesn't look like a valid ${network === "USDT_TRC20" ? "TRC20" : "BEP20"} address.` },
        { status: 400 }
      );
    }

    const { fee, receive } = computeFee(amount);
    if (receive < 9.7) {
      return NextResponse.json({ error: "Amount after fee is too low." }, { status: 400 });
    }

    // Authoritative available balance (server-side).
    const summary = await getCapitalSummary({ clientId, userId });
    if (amount > summary.availableWithdrawal) {
      return NextResponse.json(
        { error: `Amount exceeds your available balance of $${summary.availableWithdrawal.toFixed(2)}.` },
        { status: 400 }
      );
    }

    const created = await prisma.withdrawal.create({
      data: {
        userId,
        clientId,
        amount,
        fee,
        receiveAmount: receive,
        network,
        address,
        status: "pending",
      },
    });

    return NextResponse.json({ ok: true, withdrawal: created });
  } catch (err) {
    console.error("[withdrawals POST] error:", err);
    return NextResponse.json({ error: "Withdrawal request failed. Please try again." }, { status: 500 });
  }
}
