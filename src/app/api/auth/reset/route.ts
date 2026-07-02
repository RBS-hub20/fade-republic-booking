import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, TOKEN_TYPES } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";
import { enforce } from "@/lib/rate-limit";

/** Complete a password reset with a valid, unexpired token. */
export async function POST(req: Request) {
  // 10 attempts / 15 min per IP.
  const limited = enforce(req, "reset", 10, 15 * 60_000);
  if (limited) return limited;

  const { token, password } = await req.json().catch(() => ({}));
  if (!token || !password) {
    return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(String(token)) },
  });

  if (!record || record.type !== TOKEN_TYPES.PASSWORD_RESET || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(String(password)) },
    }),
    // Consume this token and any other reset tokens for the user.
    prisma.authToken.deleteMany({
      where: { userId: record.userId, type: TOKEN_TYPES.PASSWORD_RESET },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
