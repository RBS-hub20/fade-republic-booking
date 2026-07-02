import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, TOKEN_TYPES, appBaseUrl } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify an email via the link in the verification email, then redirect to the
 * status UI at /auth/verified?status=success|expired|invalid.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const base = appBaseUrl();
  const to = (status: string) => NextResponse.redirect(`${base}/auth/verified?status=${status}`);

  if (!token) return to("invalid");

  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  // Not found or wrong type → invalid; found but past expiry → expired.
  if (!record || record.type !== TOKEN_TYPES.EMAIL_VERIFY) return to("invalid");
  if (record.expiresAt < new Date()) {
    // Include the email so the UI can offer a one-click resend.
    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    await prisma.authToken.delete({ where: { id: record.id } }).catch(() => {});
    const suffix = user ? `&email=${encodeURIComponent(user.email)}` : "";
    return NextResponse.redirect(`${base}/auth/verified?status=expired${suffix}`);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.authToken.deleteMany({
      where: { userId: record.userId, type: TOKEN_TYPES.EMAIL_VERIFY },
    }),
  ]);

  return to("success");
}
