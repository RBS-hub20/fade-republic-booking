/**
 * Username feature — fully additive. Never touches referralCode, user.id, or
 * any payment/withdrawal/deposit/commission/genealogy logic.
 *
 *  - Always stored lowercase; case-insensitive uniqueness enforced by a
 *    LOWER("username") unique index (created in ensureUsernameSchemaOnce).
 *  - `usernameSet` locks the value after the single allowed change.
 */
import { prisma } from "./prisma";
import { runDdlBatch } from "./schema-ddl";

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

/** Reserved names that may never be claimed. */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "support",
  "api",
  "quantumx",
  "root",
  "null",
  "moderator",
  "staff",
]);

export interface UsernameCheck {
  ok: boolean;
  error?: string;
}

/** Normalize user input to the stored form (lowercase, trimmed). */
export function normalizeUsername(input: string): string {
  return String(input || "").trim().toLowerCase();
}

/** Format-only validation (no DB). */
export function validateUsernameFormat(input: string): UsernameCheck {
  const u = normalizeUsername(input);
  if (!u) return { ok: false, error: "Username is required." };
  if (!USERNAME_RE.test(u)) {
    return { ok: false, error: "3–30 characters, lowercase letters, numbers and underscores only." };
  }
  if (RESERVED_USERNAMES.has(u)) return { ok: false, error: "Username not available." };
  return { ok: true };
}

/** DB availability (case-insensitive), optionally excluding a user id. */
export async function isUsernameAvailable(input: string, excludeUserId?: string): Promise<boolean> {
  const u = normalizeUsername(input);
  if (!validateUsernameFormat(u).ok) return false;
  const clash = await prisma.user.findFirst({
    where: {
      username: { equals: u, mode: "insensitive" },
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return !clash;
}

// ---- runtime self-heal DDL (matches the referral/genealogy pattern) --------
type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

export const USERNAME_DDL: string[] = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" VARCHAR(30)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "usernameSet" BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_lower_key" ON "User" (LOWER("username"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_key" ON "User" (LOWER("email"))`,
];

let schemaHealed = false;
export async function ensureUsernameSchemaOnce(db: RawRunner = prisma): Promise<void> {
  if (schemaHealed) return;
  // The LOWER(email) unique index can fail if legacy case-variant duplicate
  // emails exist — that's non-fatal (login still works); it just won't latch.
  const { failures } = await runDdlBatch(db, USERNAME_DDL);
  if (failures.length === 0) schemaHealed = true;
  else console.error("[username-schema] self-heal incomplete:", failures);
}

// ---- backfill for existing users -------------------------------------------
/** Derive a base username from an email local-part: lowercase, [a-z0-9_] only. */
export function deriveUsernameBase(email: string): string {
  let b = (email.split("@")[0] || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (b.length < 3) b = (b + "user").slice(0, 30);
  return (b.slice(0, 30) || "user");
}

/** Fit `base` + numeric suffix within 30 chars. */
function withSuffix(base: string, n: number): string {
  const suffix = String(n);
  return `${base.slice(0, 30 - suffix.length)}${suffix}`;
}

/**
 * One-time backfill: give every user without a username one derived from their
 * email, deduped (juan, juan1, juan2…), usernameSet=false so they can claim
 * once. Idempotent — only fills NULL usernames.
 */
export async function backfillUsernames(): Promise<{ scanned: number; filled: number }> {
  await ensureUsernameSchemaOnce(prisma);
  const pending = await prisma.user.findMany({ where: { username: null }, select: { id: true, email: true } });
  if (pending.length === 0) return { scanned: 0, filled: 0 };

  const taken = new Set<string>();
  const existing = await prisma.user.findMany({
    where: { NOT: { username: null } },
    select: { username: true },
  });
  for (const e of existing) if (e.username) taken.add(e.username.toLowerCase());

  let filled = 0;
  for (const u of pending) {
    const base = deriveUsernameBase(u.email);
    let candidate = base;
    let n = 0;
    while (taken.has(candidate) || RESERVED_USERNAMES.has(candidate)) {
      n += 1;
      candidate = withSuffix(base, n);
    }
    taken.add(candidate);
    try {
      await prisma.user.update({ where: { id: u.id }, data: { username: candidate, usernameSet: false } });
      filled += 1;
    } catch {
      // Unique race with another process — leave for the next run.
      taken.delete(candidate);
    }
  }
  return { scanned: pending.length, filled };
}

let backfilled = false;
export async function ensureUsernamesBackfilledOnce(): Promise<void> {
  if (backfilled) return;
  // Honor the same kill switch as the schema guards: when runtime heal is off
  // (schema managed at build), skip this background backfill so it never
  // competes for the instance's DB connection on the login / page-load path.
  if (process.env.SKIP_RUNTIME_DB_HEAL === "1" || process.env.SKIP_RUNTIME_DB_HEAL === "true") {
    backfilled = true;
    return;
  }
  try {
    await backfillUsernames();
    backfilled = true;
  } catch (e) {
    console.error("[username] backfill self-heal failed:", e);
  }
}
