import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { MIN_COMMISSION_WITHDRAWAL } from "@/lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Request a payout from the referral commission balance ONLY. This never touches
 * the trading account balance: it records a CommissionWithdrawal and immediately
 * holds the amount by drawing down commissionBalance.
 */
export async function POST(req: Request) {
  const session = getSession();
  if (!session?.userId || session.role !== "client") {
    return NextResponse.json({ error: "Sign in as a client to withdraw." }, { status: 401 });
  }

  const { amount, address, network } = await req.json().catch(() => ({}));
  const value = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(value) || value < MIN_COMMISSION_WITHDRAWAL) {
    return NextResponse.json(
      { error: `Minimum withdrawal is $${MIN_COMMISSION_WITHDRAWAL}.` },
      { status: 400 }
    );
  }
  if (!address || !String(address).trim()) {
    return NextResponse.json({ error: "Enter a payout wallet address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (user.commissionBalance < value) {
    return NextResponse.json({ error: "Amount exceeds your commission balance." }, { status: 400 });
  }

  // Hold the funds atomically: create the request and decrement the balance.
  const [, updated] = await prisma.$transaction([
    prisma.commissionWithdrawal.create({
      data: {
        userId: user.id,
        amount: value,
        address: String(address).trim(),
        network: String(network || "USDT").trim(),
        status: "PENDING",
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { commissionBalance: { decrement: value } },
    }),
  ]);

  return NextResponse.json({ ok: true, commissionBalance: updated.commissionBalance });
}
