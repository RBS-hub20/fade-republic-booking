import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";
import { addMonths, LOCK_MONTHS } from "@/lib/capital";
import { creditPackageCommission } from "@/lib/referrals";
import { refreshPayoutTrackingByClient } from "@/lib/payout-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client action on a MATURED capital deposit:
 *   renew    → CapitalAction 'renewed'  (extends the lock by another 6 months)
 *   withdraw → CapitalAction 'withdrawn' (releases principal to Available Withdrawal)
 *
 * Hard lock: only matured deposits can be actioned; capital can never be
 * released before maturity.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session?.userId || session.role !== "client" || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureFinanceSchemaOnce(prisma);

    const deposit = await prisma.transaction.findUnique({ where: { id: params.id } });
    if (
      !deposit ||
      deposit.clientId !== session.clientId ||
      deposit.type !== "DEPOSIT" ||
      deposit.status !== "APPROVED"
    ) {
      return NextResponse.json({ error: "Deposit not found." }, { status: 404 });
    }

    const actions = await prisma.capitalAction.findMany({ where: { transactionId: deposit.id } });
    if (actions.some((a) => a.action === "withdrawn")) {
      return NextResponse.json({ error: "This capital was already released." }, { status: 409 });
    }
    // Maturity anchors to the latest renewal (fresh 6-month lock each renew),
    // falling back to the deposit date when never renewed.
    const lastRenewAt = actions
      .filter((a) => a.action === "renewed")
      .reduce((max, a) => Math.max(max, new Date(a.createdAt).getTime()), 0);
    const maturity = addMonths(lastRenewAt ? new Date(lastRenewAt) : new Date(deposit.date), LOCK_MONTHS);
    if (maturity.getTime() > Date.now()) {
      return NextResponse.json(
        { error: "Capital is still locked and cannot be actioned before maturity." },
        { status: 400 }
      );
    }

    const action = String((await req.json().catch(() => ({})))?.action || "");
    if (action !== "renew" && action !== "withdraw") {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    await prisma.capitalAction.create({
      data: {
        transactionId: deposit.id,
        userId: session.userId,
        clientId: session.clientId,
        action: action === "renew" ? "renewed" : "withdrawn",
        amount: deposit.amount,
      },
    });

    // On renew, the lock resets for a fresh 6-month cycle starting now (the
    // renewal action's timestamp). Return the new unlock date so the UI can
    // show an accurate toast without a round-trip.
    if (action === "renew") {
      // A renewal is a qualifying package event: pay the upline referral
      // commissions again (unlimited). Best-effort — never block the renew.
      await creditPackageCommission({
        clientId: deposit.clientId,
        amount: deposit.amount,
        event: "renewal",
      }).catch(() => {});
      // Re-locking capital refreshes the renewer's own 5x cap tracking.
      await refreshPayoutTrackingByClient(deposit.clientId).catch(() => {});
      const newUnlockAt = addMonths(new Date(), LOCK_MONTHS);
      return NextResponse.json({ ok: true, unlockAt: newUnlockAt.toISOString() });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[capital action] error:", err);
    return NextResponse.json({ error: "Action failed. Please try again." }, { status: 500 });
  }
}
