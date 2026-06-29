import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recentTradingDays, randomDailyPercent, computeEquityCurve } from "@/lib/performance";
import { CLIENT_STATUSES } from "@/lib/constants";

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(clients);
}

/**
 * Create a client. Admin only. Auto-generates a backfilled 60-day performance
 * history (random 0.3–0.6%/day) so the new client shows a meaningful curve.
 */
export async function POST(req: Request) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, phone, accountNumber, initialDeposit, startDate, status } = body;

  if (!name || !email || !accountNumber) {
    return NextResponse.json(
      { error: "name, email and accountNumber are required" },
      { status: 400 }
    );
  }

  const deposit = Number(initialDeposit) || 0;
  const start = startDate ? new Date(startDate) : new Date();
  const validStatus = CLIENT_STATUSES.includes(status) ? status : "ACTIVE";

  try {
    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone: phone || null,
        accountNumber,
        initialDeposit: deposit,
        startDate: start,
        status: validStatus,
      },
    });

    // Backfill performance over the 60 most-recent trading days.
    const days = recentTradingDays(60);
    const performances = days.map((date) => ({ date, dailyPercent: randomDailyPercent() }));
    const curve = computeEquityCurve({
      initialDeposit: deposit,
      startDate: days[0],
      ledger: [],
      performances,
    });
    const byDay = new Map(curve.map((p) => [p.date, p]));

    await prisma.dailyPerformance.createMany({
      data: performances.map((p) => ({
        clientId: client.id,
        date: new Date(`${p.date}T20:00:00.000Z`),
        dailyPercent: p.dailyPercent,
        balanceEOD: byDay.get(p.date)?.balance ?? deposit,
        pnlUsd: byDay.get(p.date)?.pnl ?? 0,
      })),
    });

    return NextResponse.json(client, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "A client with that email or account number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
