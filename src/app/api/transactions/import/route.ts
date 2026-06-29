import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Papa from "papaparse";
import {
  TRANSACTION_TYPES,
  TRANSACTION_METHODS,
  TRANSACTION_STATUSES,
} from "@/lib/constants";

/**
 * Import a ledger CSV. Rows are matched to clients by `account_number` (or
 * `client`/`email`). Expected columns (header row, case-insensitive):
 *   date, account_number | client | email, type, amount_usd | amount, method, status, notes
 */
export async function POST(req: Request) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const text = await req.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length) {
    return NextResponse.json(
      { error: `CSV parse error: ${parsed.errors[0].message}` },
      { status: 400 }
    );
  }

  // Build lookup maps for client matching.
  const clients = await prisma.client.findMany();
  const byAccount = new Map(clients.map((c) => [c.accountNumber.toLowerCase(), c.id]));
  const byEmail = new Map(clients.map((c) => [c.email.toLowerCase(), c.id]));
  const byName = new Map(clients.map((c) => [c.name.toLowerCase(), c.id]));

  const toCreate: any[] = [];
  const skipped: string[] = [];

  parsed.data.forEach((row, i) => {
    const account = (row.account_number ?? "").toLowerCase().trim();
    const email = (row.email ?? "").toLowerCase().trim();
    const name = (row.client ?? row.name ?? "").toLowerCase().trim();
    const clientId =
      byAccount.get(account) ?? byEmail.get(email) ?? byName.get(name);

    if (!clientId) {
      skipped.push(`Row ${i + 2}: no matching client`);
      return;
    }

    const type = (row.type ?? "").toUpperCase().trim();
    if (!TRANSACTION_TYPES.includes(type as any)) {
      skipped.push(`Row ${i + 2}: invalid type "${row.type}"`);
      return;
    }

    const amount = Number(row.amount_usd ?? row.amount);
    if (!Number.isFinite(amount)) {
      skipped.push(`Row ${i + 2}: invalid amount`);
      return;
    }

    const method = (row.method ?? "BANK").toUpperCase().trim();
    const status = (row.status ?? "APPROVED").toUpperCase().trim();
    const date = row.date ? new Date(row.date) : new Date();

    toCreate.push({
      clientId,
      date: isNaN(date.getTime()) ? new Date() : date,
      type,
      amount: Math.abs(amount),
      method: TRANSACTION_METHODS.includes(method as any) ? method : "BANK",
      status: TRANSACTION_STATUSES.includes(status as any) ? status : "APPROVED",
      notes: row.notes || null,
    });
  });

  if (toCreate.length) {
    await prisma.transaction.createMany({ data: toCreate });
  }

  return NextResponse.json({
    imported: toCreate.length,
    skipped: skipped.length,
    skippedDetails: skipped.slice(0, 20),
  });
}
