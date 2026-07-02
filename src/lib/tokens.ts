/**
 * One-time token helpers for email verification & password reset.
 * The raw token is emailed to the user; only its SHA-256 hash is stored, so a
 * leaked database row can't be used to verify/reset. Node runtime only.
 */
import { randomBytes, createHash } from "node:crypto";

export const TOKEN_TYPES = {
  EMAIL_VERIFY: "EMAIL_VERIFY",
  PASSWORD_RESET: "PASSWORD_RESET",
} as const;

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Resolve the app's public base URL for building links in emails. */
export function appBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // Vercel provides this automatically for the deployment.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
