import { PrismaClient } from "@prisma/client";

/**
 * Serverless-hardened Prisma singleton.
 *
 * On Vercel, each warm function instance keeps its own connection pool, and many
 * concurrent instances can exhaust Postgres's `max_connections` — which surfaces
 * as slow loads, "Timed out fetching a connection", and login failures.
 *
 * Two mitigations here:
 *  1. Reuse ONE PrismaClient per instance via a global singleton in EVERY
 *     environment (not just dev). App-Router bundles route handlers and server
 *     components separately, so a module-local instance can be created more than
 *     once per process — each with its own pool. The global guards against that.
 *  2. Tune the per-instance pool from the connection string via env vars
 *     (no redeploy needed to change them):
 *       - DB_CONNECTION_LIMIT  max connections this instance opens (Prisma
 *                              default is ~num_cpus*2+1). Set to 1 when
 *                              DATABASE_URL points at a pooler (pgbouncer).
 *       - DB_POOL_TIMEOUT      seconds to wait for a free connection before
 *                              erroring (Prisma default 10).
 *       - DB_CONNECT_TIMEOUT   seconds to wait establishing a new connection
 *                              (Prisma default 5) — fail fast on a dead DB.
 *
 * The REAL fix for serverless connection exhaustion is a connection pooler:
 * point DATABASE_URL at a pooled endpoint (Vercel Postgres `POSTGRES_PRISMA_URL`,
 * Neon/Supabase pooler, or Prisma Accelerate), set DIRECT_URL to the direct
 * endpoint (used by `prisma db push`), and set DB_CONNECTION_LIMIT=1.
 */
function tunedDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || !/^postgres(ql)?:\/\//i.test(raw)) return raw;
  try {
    const u = new URL(raw);
    let changed = false;
    const applyEnv = (param: string, envKey: string) => {
      const v = process.env[envKey];
      // Respect a value already baked into the URL; only fill from env.
      if (v && v.trim() && !u.searchParams.has(param)) {
        u.searchParams.set(param, v.trim());
        changed = true;
      }
    };
    applyEnv("connection_limit", "DB_CONNECTION_LIMIT");
    applyEnv("pool_timeout", "DB_POOL_TIMEOUT");
    applyEnv("connect_timeout", "DB_CONNECT_TIMEOUT");
    // Return the original string untouched when no tuning applied, so the
    // default connection string is never re-serialized/normalized.
    return changed ? u.toString() : raw;
  } catch {
    return raw; // non-parseable URL — leave untouched
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const tunedUrl = tunedDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(tunedUrl ? { datasources: { db: { url: tunedUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Cache the instance in EVERY environment so a process never opens two pools.
globalForPrisma.prisma = prisma;
