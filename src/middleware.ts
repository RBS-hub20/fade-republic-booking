import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { readSessionEdge } from "@/lib/session-edge";

/**
 * Gate the authenticated app behind the signed session cookie.
 *
 * Public (no session needed): the marketing landing page `/`, `/login`,
 * `/signup`, password reset. Everything else redirects unauthenticated users to
 * /login.
 *
 * ERR_TOO_MANY_REDIRECTS fix:
 *  - We used to trust mere cookie PRESENCE. A present-but-expired cookie then
 *    made middleware bounce /login -> /dashboard while the page's getSession()
 *    (which checks the hard-cap) bounced /dashboard -> /login, forever.
 *  - Now middleware DECODES the cookie and applies the SAME hard-cap expiry
 *    check as getSession(), so the two never disagree about expiry. An
 *    expired/invalid cookie is treated as logged-out AND cleared from the
 *    response, so it can't keep driving redirects.
 *  - We do NOT auto-redirect logged-in users away from /login here (the edge
 *    runtime can't verify the HMAC — only getSession() can — so an unverifiable
 *    cookie must never be trusted enough to redirect INTO the app, or a
 *    bad-signature cookie could ping-pong). Authorization itself is always
 *    enforced server-side by getSession() on each page/route.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPath =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/u/"); // public @username profiles
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/market") ||
    // Public XENA chat (marketing site visitors have no session).
    pathname.startsWith("/api/support") ||
    // Vercel Blob upload handler — auth is enforced inside (session for the
    // browser token request; signed blob token for the completion callback).
    pathname === "/api/proofs/upload" ||
    // The verify route enforces its own CRON_SECRET / admin check.
    pathname.startsWith("/api/deposits/verify") ||
    pathname === "/api/health" ||
    // Emergency "unstick me" route — must be reachable without a session so a
    // stuck user can clear their stale cookie. Enforces nothing; only clears.
    pathname === "/api/clear" ||
    // IP → country hint for the signup form (visitors have no session yet).
    pathname === "/api/geoip" ||
    pathname === "/favicon.ico" ||
    // Static files in /public (logo, icons, OG image, manifest, fonts, …) must
    // be reachable without a session so the marketing pages render for visitors.
    /\.(png|jpe?g|gif|svg|ico|webp|avif|webmanifest|json|txt|xml|woff2?|ttf|otf|mp4)$/.test(
      pathname
    );

  if (isPublicAsset) return NextResponse.next();

  // Decode + hard-cap expiry (no HMAC — see session-edge.ts). getSession()
  // still enforces the signature server-side on every page/route.
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const session = readSessionEdge(raw);
  const authed = session !== null;
  // Present but did not decode / is expired → stale; clear it so it stops
  // driving redirects (this is what breaks the ERR_TOO_MANY_REDIRECTS loop).
  const staleCookie = !!raw && !authed;

  if (!authed && !isPublicPath) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (staleCookie) url.searchParams.set("expired", "1");
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // Allow. If a stale cookie rode along on a public page (e.g. an expired cookie
  // on /login), strip it so the visitor lands clean.
  const res = NextResponse.next();
  if (staleCookie) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
