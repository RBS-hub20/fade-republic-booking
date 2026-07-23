import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Emergency "unstick me" route — a shareable one-click fix for anyone still
 * carrying a stale/invalid session cookie.
 *
 * It clears the session cookie SERVER-SIDE (this works even though the cookie is
 * httpOnly — client-side `document.cookie` cannot touch httpOnly cookies) and
 * sends the user to a clean login. Note: the fixed middleware already clears the
 * stale cookie on the next request, so this is a convenience/support link, not a
 * requirement. Safe: it only deletes the session cookie and redirects.
 *
 *   GET|POST /api/clear  ->  303 -> /login?cleared=1  (Set-Cookie clears session)
 */
function clear(req: Request) {
  // 303 See Other → the browser follows with a GET and won't cache the redirect.
  const res = NextResponse.redirect(new URL("/login?cleared=1", req.url), { status: 303 });
  // Overwrite-then-delete with the same attributes it was set with, so the
  // browser reliably drops it. A couple of legacy names are cleared too
  // (harmless if absent).
  const opts = {
    path: "/",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  res.cookies.set(SESSION_COOKIE, "", opts);
  res.cookies.delete(SESSION_COOKIE);
  for (const legacy of ["session", "quantumx_session", "token"]) {
    res.cookies.set(legacy, "", { path: "/", expires: new Date(0) });
  }
  return res;
}

export const GET = clear;
export const POST = clear;
