import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { TRANSACTION_STATUSES } from "@/lib/constants";

/** Update a transaction (e.g. approve a pending one). Admin only. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const data: any = {};
  if (body.status && TRANSACTION_STATUSES.includes(body.status)) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.amount != null) data.amount = Math.abs(Number(body.amount));

  const tx = await prisma.transaction.update({ where: { id: params.id }, data });
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
