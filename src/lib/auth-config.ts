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
}

export const SESSION_COOKIE = "rscfx_session";

/** Basic email shape check (demo-grade). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Demo credentials shown on the login screen (seeded in prisma/seed.ts). */
export const DEMO_CREDENTIALS = [
  { label: "Admin", email: "admin@quantumxglobal.com", password: "admin123" },
  { label: "Client", email: "client@quantumxglobal.com", password: "client123" },
];
