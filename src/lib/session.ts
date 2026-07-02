/**
 * Signed session cookie encode/decode (Node runtime only — uses node:crypto).
 *
 * The cookie value is `base64url(json).base64url(hmacSHA256)`. The HMAC prevents
 * tampering, so we can safely embed the user's role and clientId and trust them
 * server-side without a DB round-trip on every request.
 *
 * Do NOT import this from edge middleware or client components. Middleware only
 * checks for cookie presence; authorization happens server-side via getSession.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Session } from "./auth-config";

// A stable secret is required in production; a dev fallback keeps local setup
// zero-config. Set SESSION_SECRET in your host env for real deployments.
const SECRET =
  process.env.SESSION_SECRET || "quantumx-dev-session-secret-change-me";

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function encodeSession(session: Session): string {
  const payload = b64url(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string): Session | null {
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed?.email && parsed?.role) return parsed as Session;
  } catch {
    /* ignore */
  }
  return null;
}
