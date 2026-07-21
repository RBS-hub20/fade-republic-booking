/**
 * EDGE-safe, signature-FREE session reader for middleware ROUTING only.
 *
 * Middleware runs on the edge runtime, which cannot reliably access
 * SESSION_SECRET — it is not inlined into the middleware bundle and the edge
 * sandbox does not expose it at runtime (verified against `next build` +
 * `next start`). So we deliberately do NOT verify the HMAC here; we only
 * base64url-decode the payload and apply the same hard-cap expiry check as
 * getSession().
 *
 * This is safe: middleware only decides where to route. Real authorization (the
 * HMAC signature + expiry) is still enforced server-side by getSession() on
 * every page and route handler. A forged/unsigned cookie is optimistically
 * routed into the app and then rejected by getSession() — no data is exposed.
 *
 * Detecting expiry HERE is what fixes ERR_TOO_MANY_REDIRECTS: an expired cookie
 * is now seen as logged-out by middleware (and cleared), so it stops bouncing
 * between /login and /dashboard. Middleware and getSession no longer disagree
 * about whether an expired cookie is "logged in".
 */
import { isSessionHardExpired, type Session } from "./auth-config";

/** Decode (WITHOUT verifying the signature) + hard-cap expiry check. */
export function readSessionEdge(raw: string | undefined): Session | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  const payloadPart = dot > 0 ? raw.slice(0, dot) : raw; // strip the signature
  try {
    const b64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Session;
    if (!parsed?.email || !parsed?.role) return null;
    if (isSessionHardExpired(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
