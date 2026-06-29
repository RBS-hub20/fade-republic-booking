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
