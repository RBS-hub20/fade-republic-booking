import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-config";

/**
 * Gate the authenticated app behind the demo session cookie.
 *
 * Public (no session needed): the marketing landing page `/`, `/login`,
 * `/signup`. Everything else redirects unauthenticated users to /login.
 * Authenticated users hitting /login or /signup are sent to /dashboard.
 *
 * NOTE: This only checks for cookie presence (edge runtime can't decode our
 * base64 session easily without extra work). Real apps should verify a signed
 * token here.
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
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  const isPublicPath = PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/market") ||
    pathname === "/api/health" ||
    pathname === "/favicon.ico";

  if (isPublicAsset) return NextResponse.next();

  if (!hasSession && !isPublicPath) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed-in users don't need the auth screens.
  if (hasSession && (pathname === "/login" || pathname === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
