import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  TRANSACTION_TYPES,
  TRANSACTION_METHODS,
  TRANSACTION_STATUSES,
} from "@/lib/constants";

/** Build a Prisma `where` from query filters (clientId, from, to date range). */
function buildWhere(searchParams: URLSearchParams) {
  const where: any = {};
  const clientId = searchParams.get("clientId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (clientId && clientId !== "all") where.clientId = clientId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.date.lte = new Date(`${to}T23:59:59.999Z`);
  }
  return where;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const transactions = await prisma.transaction.findMany({
    where: buildWhere(searchParams),
    orderBy: { date: "desc" },
    include: { client: { select: { name: true, accountNumber: true } } },
  });
  return NextResponse.json(transactions);
}

export async function POST(req: Request) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { clientId, date, type, amount, method, status, notes } = body;

  if (!clientId || !type || amount == null) {
    return NextResponse.json(
      { error: "clientId, type and amount are required" },
      { status: 400 }
    );
  }
  if (!TRANSACTION_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
  }

  const tx = await prisma.transaction.create({
    data: {
      clientId,
      date: date ? new Date(date) : new Date(),
      type,
      amount: Math.abs(Number(amount)),
      method: TRANSACTION_METHODS.includes(method) ? method : "BANK",
      status: TRANSACTION_STATUSES.includes(status) ? status : "APPROVED",
      notes: notes || null,
    },
  });

  return NextResponse.json(tx, { status: 201 });
}
