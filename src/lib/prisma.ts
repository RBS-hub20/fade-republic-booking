import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton.
 *
 * The connection URL (incl. pooling flags like `?pgbouncer=true&connection_limit=1`
 * for a Neon/PgBouncer pooled endpoint) is read NATIVELY from `env("DATABASE_URL")`
 * via the schema datasource — NOT injected through a runtime `datasources`
 * override. That native path is where Prisma reliably honors `pgbouncer=true`
 * (which disables prepared statements for transaction-pooling), so we keep it
 * untouched. Tune pooling by editing DATABASE_URL / DIRECT_URL in the host env.
 *
 * We reuse ONE PrismaClient per instance via a global singleton in EVERY
 * environment (not just dev): App-Router bundles route handlers and server
 * components separately, so a module-local instance can otherwise be created
 * more than once per process — each opening its own pool.
 */
// `directUrl` in the schema is CLI-only (migrations), but Prisma still resolves
// the referenced env var — default it to DATABASE_URL so init never throws
// "Environment variable not found: DIRECT_URL" where no separate direct
// endpoint is configured (local dev / no pooler). It's unused at runtime.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
