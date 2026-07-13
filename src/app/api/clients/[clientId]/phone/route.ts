import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  normalizeCountryCode,
  normalizePhoneNumber,
  isValidPhoneNumber,
  formatFullPhone,
  ensurePhoneSchemaOnce,
} from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: update a client's cellphone number. Writes the structured
 * countryCode/phoneNumber onto the linked User and the combined display number
 * onto Client.phone (used by the reports/admin views).
 */
export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const countryCode = normalizeCountryCode(body.countryCode);
  const phoneNumber = normalizePhoneNumber(body.phoneNumber);
  if (!isValidPhoneNumber(phoneNumber)) {
    return NextResponse.json(
      { error: "Please enter a valid cellphone number (10–11 digits)." },
      { status: 400 }
    );
  }

  const client = await prisma.client.findUnique({ where: { id: params.clientId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    await ensurePhoneSchemaOnce(prisma);
    const user = await prisma.user.findUnique({ where: { clientId: client.id } });

    await prisma.$transaction([
      prisma.client.update({
        where: { id: client.id },
        data: { phone: formatFullPhone(countryCode, phoneNumber) },
      }),
      ...(user
        ? [
            prisma.user.update({
              where: { id: user.id },
              // Editing the number resets verification (future OTP).
              data: { countryCode, phoneNumber, phoneVerified: false },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ ok: true, countryCode, phoneNumber });
  } catch (e) {
    console.error("[clients/phone PATCH] error:", e);
    return NextResponse.json({ error: "Could not update the phone number." }, { status: 500 });
  }
}
