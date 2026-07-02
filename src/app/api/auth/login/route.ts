import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, type Session, type Role } from "@/lib/auth-config";
import { encodeSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { enforce } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // 10 attempts / 15 min per IP.
  const limited = enforce(req, "login", 10, 15 * 60_000);
  if (limited) return limited;

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
  });

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const session: Session = {
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    name: user.name,
    clientId: user.clientId,
  };

  const res = NextResponse.json({ ok: true, role: session.role });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
