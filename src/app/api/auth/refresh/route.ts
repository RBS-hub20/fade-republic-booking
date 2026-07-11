import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_POLICY } from "@/lib/auth-config";
import { encodeSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Stay logged in" / access refresh. Re-issues the session cookie WITHOUT
 * changing its `iat`, so the absolute hard cap is preserved (a refresh can
 * never extend a session past its 8h/4h limit). Returns the remaining hard-cap
 * time so the client can keep its countdown accurate.
 *
 * getSession() already rejects a session past its hard cap, so a 401 here means
 * the client must log out.
 */
export async function POST() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const hardCapMs = SESSION_POLICY[session.role].hardCapMs;
  const remainingMs = session.iat ? Math.max(0, session.iat + hardCapMs - Date.now()) : hardCapMs;

  const res = NextResponse.json({ ok: true, iat: session.iat ?? null, remainingMs });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
