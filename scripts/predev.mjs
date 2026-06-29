/**
 * Runs before `next dev`. Makes the app work out of the box:
 *   1. Generates the Prisma client (no-op if up to date).
 *   2. Pushes the schema to the SQLite DB (creates dev.db if missing).
 *   3. Seeds demo data on first run (when the DB has no clients yet).
 */
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dbPath = join(root, "prisma", "dev.db");
const envPath = join(root, ".env");

function run(cmd) {
  console.log(`▸ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

// .env is gitignored; create a default SQLite one on a fresh clone so the app
// works out of the box.
if (!existsSync(envPath)) {
  console.log("📝 Creating default .env (SQLite)...");
  writeFileSync(envPath, 'DATABASE_URL="file:./dev.db"\n');
}

const firstRun = !existsSync(dbPath);

try {
  run("prisma generate");
  run("prisma db push --skip-generate");

  if (firstRun) {
    console.log("📦 First run detected — seeding demo data...");
    run("tsx prisma/seed.ts");
  }
} catch (err) {
  console.error("⚠️  Database setup failed:", err.message);
  console.error("   You can set it up manually with: npm run db:reset");
  // Don't block dev server startup on seed failure.
}
