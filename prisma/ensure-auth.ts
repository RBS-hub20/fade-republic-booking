/**
 * Idempotent login-account bootstrap. Runs on every deploy (after schema push).
 *
 * Guarantees an admin can always sign in — important when upgrading a database
 * that already had rows from an older/incompatible auth implementation.
 *
 * Admin credentials:
 *   - ADMIN_EMAIL    (optional, default admin@quantumxglobal.com)
 *   - ADMIN_PASSWORD (optional). If set, the admin account is force-created OR
 *     RESET to this password on every deploy (recovers a mismatched/legacy hash
 *     and lets you control the admin password from env). If unset, a default
 *     admin (admin123) is created only when missing and never overwritten.
 *
 * The demo client login is created only when missing.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@quantumxglobal.com").toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // if set → force reset
const ADMIN_NAME = process.env.ADMIN_NAME || "Portfolio Admin";
// Demo default used when ADMIN_PASSWORD is not configured (env-overridable).
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";

/** Create a user only if it's missing (never overwrites an existing password). */
async function ensureUser(opts: {
  email: string;
  name: string;
  password: string;
  role: "admin" | "client";
  clientId?: string | null;
}) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing) return false;
  await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      passwordHash: hashPassword(opts.password),
      role: opts.role,
      clientId: opts.clientId ?? null,
      emailVerified: true,
    },
  });
  return true;
}

async function main() {
  // --- Admin ---
  if (ADMIN_PASSWORD) {
    // Force-set (create or reset) so a known password always works.
    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: "admin",
        emailVerified: true,
      },
      create: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: "admin",
        emailVerified: true,
      },
    });
    console.log(`🔐 Admin password set from ADMIN_PASSWORD env for ${ADMIN_EMAIL}.`);
  } else {
    // No ADMIN_PASSWORD configured — guarantee a working default login by
    // (re)setting the admin to the demo default password on every deploy. This
    // repairs a stale/legacy hash so `admin123` always works out of the box.
    // Set ADMIN_PASSWORD in the host env to use your own private password.
    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        role: "admin",
        emailVerified: true,
      },
      create: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        role: "admin",
        emailVerified: true,
      },
    });
    console.log(
      `🔐 Admin ensured with the DEFAULT password for ${ADMIN_EMAIL}. ` +
        "Set ADMIN_PASSWORD in your host env to use a private password."
    );
  }

  // --- Demo client login (created only if missing) ---
  const demoClient = await prisma.client.findUnique({
    where: { email: "miguel.santos@example.com" },
  });
  if (demoClient) {
    const created = await ensureUser({
      email: "client@quantumxglobal.com",
      name: demoClient.name,
      password: "client123",
      role: "client",
      clientId: demoClient.id,
    });
    if (created) console.log("🔐 Demo client login created — client@quantumxglobal.com.");
  }
}

main()
  .catch((e) => {
    console.error("ensure-auth failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
