import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

/** Export the (optionally filtered) ledger as a CSV download. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
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

  const txns = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    include: { client: { select: { name: true, accountNumber: true } } },
  });

  const rows = txns.map((t) => ({
    date: t.date.toISOString().slice(0, 10),
    client: t.client.name,
    account_number: t.client.accountNumber,
    type: t.type,
    amount_usd: t.amount,
    method: t.method,
    status: t.status,
    notes: t.notes ?? "",
  }));

  const csv = Papa.unparse(rows, {
    columns: [
      "date",
      "client",
      "account_number",
      "type",
      "amount_usd",
      "method",
      "status",
      "notes",
    ],
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="ledger-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
