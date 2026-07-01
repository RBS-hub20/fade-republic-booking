/**
 * Shared auth constants + helpers safe to import from client components,
 * middleware (edge), and server code alike. NO next/headers here.
 *
 * Server-only session reading lives in auth.ts (`getSession`).
 */

export type Role = "admin" | "client";

export interface Session {
  email: string;
  role: Role;
  name: string;
}

export const SESSION_COOKIE = "rscfx_session";

// Demo credentials. Replace with a real user table + password hashing.
const DEMO_USERS: Record<string, { password: string; role: Role; name: string }> = {
  "admin@rscryptofx.com": { password: "admin123", role: "admin", name: "Portfolio Admin" },
  "client@rscryptofx.com": { password: "client123", role: "client", name: "Demo Client" },
};

export function verifyCredentials(email: string, password: string): Session | null {
  const user = DEMO_USERS[email.toLowerCase().trim()];
  if (!user || user.password !== password) return null;
  return { email: email.toLowerCase().trim(), role: user.role, name: user.name };
}

/**
 * Build a session for a newly signed-up user. This demo issues a `client`-role
 * session directly from the submitted details — it does NOT persist an account
 * or password.
 *
 * TO MAKE SIGNUP REAL: create a user + hashed password in your store here, then
 * have `verifyCredentials` check against it.
 */
export function createSignupSession(name: string, email: string): Session {
  const clean = email.toLowerCase().trim();
  return { email: clean, role: "client", name: name.trim() || clean };
}

/** Basic email shape check (demo-grade). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64");
}

export function decodeSession(raw: string): Session | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (parsed?.email && parsed?.role) return parsed as Session;
  } catch {
    /* ignore */
  }
  return null;
}

export const DEMO_CREDENTIALS = [
  { label: "Admin", email: "admin@rscryptofx.com", password: "admin123" },
  { label: "Client", email: "client@rscryptofx.com", password: "client123" },
];
