/**
 * Ensures a DATABASE_URL is available for `prisma generate` / `next build`.
 *
 * On hosts like Vercel there is no repo `.env`, and `prisma generate` fails if
 * the datasource's env("DATABASE_URL") is undefined. We write a harmless SQLite
 * default so the BUILD succeeds. (Runtime DB connectivity is separate — set a
 * real DATABASE_URL env var in your host for a working production database.)
 */
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

if (!process.env.DATABASE_URL && !existsSync(envPath)) {
  console.log("📝 No DATABASE_URL / .env found — writing SQLite default for build.");
  writeFileSync(envPath, 'DATABASE_URL="file:./dev.db"\n');
}
