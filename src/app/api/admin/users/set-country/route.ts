import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  normalizeCountry,
  countryName,
  countryTimezone,
  ensureCountrySchemaOnce,
} from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bulk-set the country for selected users (migration tool for existing accounts
 * created before the country field). Updates each User's country/countryName/
 * timezone and mirrors country/countryName onto their linked Client so the
 * admin views stay consistent. Admin only.
 *
 *   POST /api/admin/users/set-country  { userIds: string[], country: string }
 */
export async function POST(req: Request) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { userIds, country } = await req.json().catch(() => ({}));
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "Select at least one user." }, { status: 400 });
  }
  const code = normalizeCountry(country);
  const name = countryName(code);
  const tz = countryTimezone(code);

  try {
    await ensureCountrySchemaOnce(prisma);
    const ids = userIds.filter((x): x is string => typeof x === "string");

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, clientId: true },
    });

    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { country: code, countryName: name, timezone: tz },
    });

    const clientIds = users.map((u) => u.clientId).filter((x): x is string => Boolean(x));
    if (clientIds.length) {
      await prisma.client.updateMany({
        where: { id: { in: clientIds } },
        data: { country: code, countryName: name },
      });
    }

    return NextResponse.json({ ok: true, updated: users.length, country: code, countryName: name });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message?.split("\n")[0] ?? "Failed to set country" },
      { status: 500 }
    );
  }
}
