/**
 * Shared auth constants + types safe to import from client components,
 * middleware (edge), and server code alike. NO node:crypto / next/headers here.
 *
 * - Session encode/decode (signed): src/lib/session.ts (Node only)
 * - Password hashing:               src/lib/password.ts (Node only)
 * - Server session reader:          src/lib/auth.ts (getSession)
 */

export type Role = "admin" | "client";

export interface Session {
  userId?: string;
  email: string;
  role: Role;
  name: string;
  /** Set for client-role users: their trading account id. */
  clientId?: string | null;
  /** Whether the user's email was verified at login time. */
  emailVerified?: boolean;
  /** Login time (epoch ms). Immutable — drives the hard session cap. */
  iat?: number;
}

export const SESSION_COOKIE = "rscfx_session";

/**
 * Security / session-timeout policy (per role). Shared by the client-side
 * inactivity guard and the server-side hard-cap enforcement in getSession().
 */
export const SESSION_POLICY: Record<Role, { idleMs: number; hardCapMs: number }> = {
  // Clients: 30-min idle logout, 8-hour absolute session cap.
  client: { idleMs: 30 * 60_000, hardCapMs: 8 * 60 * 60_000 },
  // Admins: stricter — 15-min idle, 4-hour absolute cap.
  admin: { idleMs: 15 * 60_000, hardCapMs: 4 * 60 * 60_000 },
};

/** Show the "session expiring" warning this long before the idle logout. */
export const IDLE_WARN_BEFORE_MS = 2 * 60_000; // 2 minutes
/** Once the warning shows, auto-logout after this long with no response. */
export const IDLE_WARN_RESPONSE_MS = 60_000; // 60 seconds

/** True when a session has exceeded its role's absolute (hard) cap. */
export function isSessionHardExpired(session: Session, now = Date.now()): boolean {
  if (!session.iat) return false; // legacy cookie without iat — grandfathered
  return now - session.iat > SESSION_POLICY[session.role].hardCapMs;
}

/** Basic email shape check (demo-grade). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Demo credentials shown on the login screen (seeded in prisma/seed.ts). */
export const DEMO_CREDENTIALS = [
  { label: "Admin", email: "admin@quantumxglobal.com", password: "admin123" },
  { label: "Client", email: "client@quantumxglobal.com", password: "client123" },
];
