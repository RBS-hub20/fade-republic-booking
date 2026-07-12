import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { TRANSACTION_STATUSES } from "@/lib/constants";
import { notifyDepositApproved, notifyWithdrawalApproved } from "@/lib/mailers";
import { creditPackageCommission } from "@/lib/referrals";
import { refreshPayoutTrackingByClient } from "@/lib/payout-cap";

/** Update a transaction (e.g. approve a pending one). Admin only. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const before = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: { client: true },
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  if (body.status && TRANSACTION_STATUSES.includes(body.status)) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.amount != null) data.amount = Math.abs(Number(body.amount));

  const tx = await prisma.transaction.update({ where: { id: params.id }, data });

  // Email the client when a request is approved (PENDING → APPROVED).
  const justApproved = before.status !== "APPROVED" && tx.status === "APPROVED";
  if (justApproved && before.client) {
    if (before.type === "DEPOSIT") {
      notifyDepositApproved({
        email: before.client.email,
        name: before.client.name,
        amount: tx.amount,
        method: tx.method,
        auto: false,
      }).catch(() => {});
      // Credit referral commissions for this package purchase (unlimited).
      await creditPackageCommission({ clientId: before.clientId, amount: tx.amount, event: "purchase" });
      // New capital raises the depositor's 5x cap (un-caps them if applicable).
      await refreshPayoutTrackingByClient(before.clientId).catch(() => {});
    } else if (before.type === "WITHDRAWAL") {
      notifyWithdrawalApproved({
        email: before.client.email,
        name: before.client.name,
        amount: tx.amount,
        method: tx.method,
      }).catch(() => {});
    }
  }

  return NextResponse.json(tx);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  await prisma.transaction.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
