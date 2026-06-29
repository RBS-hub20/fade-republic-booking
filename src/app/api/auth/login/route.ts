import { NextResponse } from "next/server";
import { verifyCredentials, encodeSession, SESSION_COOKIE } from "@/lib/auth-config";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const session = verifyCredentials(email ?? "", password ?? "");

  if (!session) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role: session.role });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
