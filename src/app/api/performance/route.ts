import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { randomDailyPercent, toManilaDateKey } from "@/lib/performance";

/**
 * Upsert a single day's actual performance percentage for a client.
 * Admin only. If `dailyPercent` is omitted/blank, a random 0.3–0.6% estimate
 * is used (the portal's default behaviour).
 *
 * balanceEOD is recomputed lazily by the data layer from the full curve, so we
 * only need to persist the percentage here.
 */
export async function POST(req: Request) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { clientId, date, dailyPercent, notes } = await req.json();
  if (!clientId || !date) {
    return NextResponse.json({ error: "clientId and date are required" }, { status: 400 });
  }

  const pct =
    dailyPercent === "" || dailyPercent == null
      ? randomDailyPercent()
      : Number(dailyPercent);

  if (!Number.isFinite(pct)) {
    return NextResponse.json({ error: "Invalid dailyPercent" }, { status: 400 });
  }

  // Normalise the date to a noon-UTC timestamp keyed by the Manila day, so the
  // unique (clientId, date) constraint matches existing rows.
  const dayKey = toManilaDateKey(date);
  const normalized = new Date(`${dayKey}T20:00:00.000Z`);

  const record = await prisma.dailyPerformance.upsert({
    where: { clientId_date: { clientId, date: normalized } },
    create: {
      clientId,
      date: normalized,
      dailyPercent: pct,
      balanceEOD: 0, // recomputed by the data layer / curve
      notes: notes || null,
    },
    update: { dailyPercent: pct, notes: notes || null },
  });

  return NextResponse.json(record);
}
