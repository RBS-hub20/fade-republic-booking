/**
 * Server-only session helpers (use next/headers + node:crypto). Import only from
 * server components and route handlers. Client code / middleware should import
 * the cookie name and types from auth-config.ts instead.
 */
import { cookies } from "next/headers";
import { SESSION_COOKIE, isSessionHardExpired, type Session } from "./auth-config";
import { decodeSession } from "./session";

export function getSession(): Session | null {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = decodeSession(raw);
  if (!session) return null;
  // Absolute (hard) session cap — cannot be bypassed by client-side activity.
  if (isSessionHardExpired(session)) return null;
  return session;
}

/** Convenience guards. */
export function isAdmin(session: Session | null): boolean {
  return session?.role === "admin";
}

export type { Session, Role } from "./auth-config";
