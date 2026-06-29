/**
 * Server-only session reading (uses next/headers). Import this only from server
 * components and route handlers. Client code / middleware should import the
 * cookie name and credential helpers from auth-config.ts instead.
 *
 * TO REPLACE WITH REAL AUTH:
 *   Swap `verifyCredentials` (auth-config.ts) for a lookup against your user
 *   store, and replace the base64 cookie with a signed/encrypted session
 *   (NextAuth, Lucia, JWT). The app only depends on `getSession()` returning a
 *   role.
 */
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession, type Session } from "./auth-config";

export function getSession(): Session | null {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export type { Session, Role } from "./auth-config";
