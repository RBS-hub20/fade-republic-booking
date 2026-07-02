import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, TOKEN_TYPES, appBaseUrl } from "@/lib/tokens";

/** Verify an email via the link in the verification email, then redirect. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const base = appBaseUrl();

  if (!token) {
    return NextResponse.redirect(`${base}/login?verify=invalid`);
  }

  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.type !== TOKEN_TYPES.EMAIL_VERIFY || record.expiresAt < new Date()) {
    return NextResponse.redirect(`${base}/login?verify=invalid`);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.authToken.deleteMany({
      where: { userId: record.userId, type: TOKEN_TYPES.EMAIL_VERIFY },
    }),
  ]);

  return NextResponse.redirect(`${base}/dashboard?verify=success`);
}
