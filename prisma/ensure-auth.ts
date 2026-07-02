/**
 * Idempotent login-account bootstrap. Runs on every deploy (after schema push).
 *
 * Guarantees an admin can always sign in — important when upgrading a database
 * that already had Client rows from before the User model existed (the empty-DB
 * seed would otherwise be skipped, leaving no users).
 *
 * Only CREATES accounts that are missing; it never overwrites an existing
 * password, so changed credentials are preserved across deploys.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

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
  // Always ensure an admin exists.
  const createdAdmin = await ensureUser({
    email: "admin@quantumxglobal.com",
    name: "Portfolio Admin",
    password: "admin123",
    role: "admin",
  });

  // If the demo client exists but has no login yet, link one (demo convenience).
  const demoClient = await prisma.client.findUnique({
    where: { email: "miguel.santos@example.com" },
  });
  let createdClient = false;
  if (demoClient) {
    createdClient = await ensureUser({
      email: "client@quantumxglobal.com",
      name: demoClient.name,
      password: "client123",
      role: "client",
      clientId: demoClient.id,
    });
  }

  if (createdAdmin || createdClient) {
    console.log(
      `🔐 Ensured login accounts (admin: ${createdAdmin ? "created" : "exists"}` +
        `, demo client: ${createdClient ? "created" : demoClient ? "exists" : "n/a"}).`
    );
  } else {
    console.log("🔐 Login accounts already present.");
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
