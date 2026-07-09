import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";
import { addMonths, LOCK_MONTHS } from "@/lib/capital";

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
    const renewals = actions.filter((a) => a.action === "renewed").length;
    const maturity = addMonths(new Date(deposit.date), LOCK_MONTHS * (1 + renewals));
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[capital action] error:", err);
    return NextResponse.json({ error: "Action failed. Please try again." }, { status: 500 });
  }
}
