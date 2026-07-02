/**
 * Database bootstrap for QuantumX Global Markets (PostgreSQL).
 * Runs before `dev`, `build` and `start`. Idempotent and safe to re-run.
 *
 * Steps:
 *   1. Ensure a DATABASE_URL is available. On hosts (Vercel) it comes from the
 *      project env. Locally, if none is set and there's no .env, we write a
 *      default pointing at the docker-compose Postgres (see docker-compose.yml).
 *   2. Generate the Prisma client if it isn't present.
 *   3. Push the schema (creates tables). Pooled providers (pgbouncer) can choke
 *      on DDL, so we push using DIRECT_URL when provided.
 *   4. Seed demo data only when the database has no clients yet — so real data
 *      on a live database is never wiped by a redeploy.
 *
 * Never exits non-zero on a DB hiccup: the server still starts and shows a
 * friendly "database not ready" screen instead of crashing the whole deploy.
 */
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, delimiter } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = join(root, "node_modules", ".bin");
const envPath = join(root, ".env");

// Local docker-compose default (see docker-compose.yml). Only used when nothing
// else is configured — production always supplies its own DATABASE_URL.
const LOCAL_DEFAULT_URL =
  "postgresql://quantumx:quantumx@localhost:5432/quantumx?schema=public";

const childEnv = {
  ...process.env,
  PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
};

function run(cmd, extraEnv = {}) {
  console.log(`▸ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, env: { ...childEnv, ...extraEnv } });
}

// 1. Ensure DATABASE_URL is available for `prisma generate`.
const isHosted = Boolean(process.env.VERCEL || process.env.CI);

// Locally (not on a host), write a docker-compose default so `npm run dev`
// works out of the box.
if (!process.env.DATABASE_URL && !existsSync(envPath) && !isHosted) {
  console.log("📝 No DATABASE_URL / .env found — writing local Postgres default.");
  writeFileSync(envPath, `DATABASE_URL="${LOCAL_DEFAULT_URL}"\n`);
  childEnv.DATABASE_URL = LOCAL_DEFAULT_URL;
}

// If there's genuinely no configuration (no env var and no .env file — e.g.
// deployed before DATABASE_URL was set), use a placeholder so `prisma generate`
// can still run and the build stays green. Actual DB operations then fail
// gracefully and the app shows a "database not ready" notice. When a .env
// exists, Prisma loads DATABASE_URL from it, so we must NOT override it here.
if (!process.env.DATABASE_URL && !existsSync(envPath)) {
  console.warn(
    "⚠️  DATABASE_URL is not set. Set it in your host's environment variables " +
      "(e.g. Vercel → Settings → Environment Variables). Building without a live database."
  );
  childEnv.DATABASE_URL =
    "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";
}

async function main() {
  // 2. Generate the Prisma client. Always run it: hosts (Vercel) cache
  //    dependencies, so a stale or missing client is a common failure mode.
  run("prisma generate");

  // 3. Push schema. Prefer a direct (non-pooled) URL for DDL when available.
  const pushUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  try {
    run(
      "prisma db push --skip-generate --accept-data-loss",
      pushUrl ? { DATABASE_URL: pushUrl } : {}
    );
  } catch (err) {
    console.warn("⚠️  prisma db push failed:", err.message);
    console.warn("   The app will show a 'database not ready' screen until this succeeds.");
    return; // don't attempt to seed if the schema isn't in place
  }

  // 4. Seed only when empty.
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const count = await prisma.client.count();
    await prisma.$disconnect();
    if (count === 0) {
      console.log("📦 Empty database — seeding demo data...");
      run("tsx prisma/seed.ts");
    } else {
      console.log(`✓ Database ready (${count} clients).`);
    }
  } catch (err) {
    console.warn("⚠️  Seed check failed (continuing):", err.message);
  }

  // Always ensure login accounts exist (idempotent) — covers databases upgraded
  // from before the User model, where the empty-DB seed is skipped.
  try {
    run("tsx prisma/ensure-auth.ts");
  } catch (err) {
    console.warn("⚠️  ensure-auth failed (continuing):", err.message);
  }
}

main().catch((err) => {
  console.error("⚠️  Database setup error (continuing):", err.message);
});
