/**
 * Idempotent database setup, shared by `predev` and `prestart`.
 *
 * Makes the app work out of the box in BOTH dev and production:
 *   1. Ensure a default .env exists (SQLite).
 *   2. Generate the Prisma client if it's missing.
 *   3. Push the schema (creates the SQLite DB + tables if absent).
 *   4. Seed demo data when the database has no clients yet.
 *
 * Safe to run repeatedly. Never throws hard — a setup hiccup should not block
 * the server from starting (the app surfaces a friendly DB-not-ready screen).
 */
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, delimiter } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const binDir = join(root, "node_modules", ".bin");
const generatedClient = join(root, "node_modules", ".prisma", "client", "index.js");

// Ensure local CLIs (prisma, tsx) resolve even when run outside an npm script.
const childEnv = {
  ...process.env,
  PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
};

function run(cmd) {
  console.log(`▸ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, env: childEnv });
}

async function main() {
  // 1. .env (gitignored) — create a SQLite default on fresh clones.
  if (!existsSync(envPath)) {
    console.log("📝 Creating default .env (SQLite)...");
    writeFileSync(envPath, 'DATABASE_URL="file:./dev.db"\n');
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./dev.db";
  }

  // 2. Generate the Prisma client only if it isn't there (build already does it).
  if (!existsSync(generatedClient)) {
    run("prisma generate");
  }

  // 3. Create/sync the database schema (idempotent).
  run("prisma db push --skip-generate --accept-data-loss");

  // 4. Seed when empty.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const count = await prisma.client.count();
    if (count === 0) {
      console.log("📦 Empty database — seeding demo data...");
      await prisma.$disconnect();
      run("tsx prisma/seed.ts");
    } else {
      console.log(`✓ Database ready (${count} clients).`);
      await prisma.$disconnect();
    }
  } catch (err) {
    await prisma.$disconnect().catch(() => {});
    // Tables might not exist yet if db push failed; try a seed as a last resort.
    console.warn("⚠️  Could not read client count, attempting seed:", err.message);
    try {
      run("tsx prisma/seed.ts");
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error("⚠️  Database setup failed:", err.message);
  console.error("   Run it manually with: npm run db:reset");
  // Do not exit non-zero — let the server start and show a friendly error.
});
