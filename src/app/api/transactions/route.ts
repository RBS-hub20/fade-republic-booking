import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  TRANSACTION_TYPES,
  TRANSACTION_METHODS,
  TRANSACTION_STATUSES,
} from "@/lib/constants";

/** Build a Prisma `where` from query filters (clientId, from, to date range). */
function buildWhere(searchParams: URLSearchParams, forceClientId?: string | null) {
  const where: any = {};
  const clientId = forceClientId ?? searchParams.get("clientId");
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
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  // Clients are locked to their own account; admins may filter freely.
  const forceClientId = session.role === "client" ? session.clientId ?? "__none__" : null;

  const transactions = await prisma.transaction.findMany({
    where: buildWhere(searchParams, forceClientId),
    orderBy: { date: "desc" },
    include: { client: { select: { name: true, accountNumber: true } } },
  });
  return NextResponse.json(transactions);
}

export async function POST(req: Request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, amount, method, notes } = body;
  const isAdmin = session.role === "admin";

  if (!type || amount == null) {
    return NextResponse.json({ error: "type and amount are required" }, { status: 400 });
  }
  if (!TRANSACTION_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
  }
  const value = Math.abs(Number(amount));
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  // Clients may only file a PENDING request on their OWN account.
  // Admins may create for any client with any status.
  let clientId: string;
  let status: string;
  if (isAdmin) {
    clientId = body.clientId;
    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }
    status = TRANSACTION_STATUSES.includes(body.status) ? body.status : "APPROVED";
  } else {
    if (!session.clientId) {
      return NextResponse.json({ error: "No trading account linked to this user" }, { status: 400 });
    }
    clientId = session.clientId;
    status = "PENDING";
  }

  const tx = await prisma.transaction.create({
    data: {
      clientId,
      date: isAdmin && body.date ? new Date(body.date) : new Date(),
      type,
      amount: value,
      method: TRANSACTION_METHODS.includes(method) ? method : "BANK",
      status,
      notes: notes ? String(notes).slice(0, 500) : null,
    },
  });

  return NextResponse.json(tx, { status: 201 });
}
