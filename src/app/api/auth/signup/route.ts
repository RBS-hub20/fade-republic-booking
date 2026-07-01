import { NextResponse } from "next/server";
import {
  createSignupSession,
  encodeSession,
  isValidEmail,
  SESSION_COOKIE,
} from "@/lib/auth-config";

/**
 * Demo signup: validates input and issues a `client`-role session cookie.
 * Does not persist an account (see createSignupSession). Works without a
 * database, so it functions on serverless hosts too.
 */
export async function POST(req: Request) {
  const { name, email, password } = await req.json().catch(() => ({}));

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email and password are all required" },
      { status: 400 }
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const session = createSignupSession(name, email);
  const res = NextResponse.json({ ok: true, role: session.role });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
