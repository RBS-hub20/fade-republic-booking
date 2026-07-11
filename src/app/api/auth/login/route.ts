import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, type Session, type Role } from "@/lib/auth-config";
import { encodeSession } from "@/lib/session";
import { verifyPassword, hashPassword } from "@/lib/password";
import { enforce } from "@/lib/rate-limit";
import { getClientPerformance } from "@/lib/data";
import { ensureUsernameSchemaOnce, ensureUsernamesBackfilledOnce } from "@/lib/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@quantumxglobal.com").toLowerCase().trim();
const ADMIN_NAME = process.env.ADMIN_NAME || "Portfolio Admin";

// Only ever read the stable auth columns. This keeps login working even if a
// newer migration (e.g. referral fields) hasn't been applied to the DB yet —
// Prisma would otherwise SELECT every column and throw on a missing one.
const AUTH_SELECT = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  role: true,
  emailVerified: true,
  clientId: true,
} as const;

// Server-side only (visible in Vercel function logs) — never logs secrets.
function log(...args: unknown[]) {
  console.log("[auth:login]", ...args);
}

export async function POST(req: Request) {
  const limited = enforce(req, "login", 10, 15 * 60_000);
  if (limited) {
    log("rate-limited");
    return limited;
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email or username and password are required" }, { status: 400 });
  }
  // `email` is really an identifier now — an email OR a username. Login is
  // case-insensitive on both.
  const identifier = String(email).trim();
  const cleanEmail = identifier.toLowerCase();

  if (!process.env.SESSION_SECRET) {
    log("WARNING: SESSION_SECRET is not set — using an insecure dev fallback secret.");
  }

  // Ensure the username column exists before we reference it in the WHERE.
  await ensureUsernameSchemaOnce(prisma).catch(() => {});
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { username: { equals: identifier, mode: "insensitive" } },
      ],
    },
    select: AUTH_SELECT,
  });
  let passOk = !!user && verifyPassword(String(password), user.passwordHash);
  const envPassSet = Boolean(process.env.ADMIN_PASSWORD);
  console.log("[auth:login]", { email: cleanEmail, userFound: !!user, passOk, envPassSet });
  log(`role=${user?.role ?? "n/a"} verified=${user?.emailVerified ?? "n/a"}`);

  // --- ADMIN_PASSWORD env fallback -----------------------------------------
  // If a matching ADMIN_PASSWORD is configured, (re)provision and log in the
  // admin regardless of DB state (missing row, stale/legacy hash, unverified).
  // Guarantees admin access as long as ADMIN_PASSWORD is set in the host env.
  if (
    !passOk &&
    process.env.ADMIN_PASSWORD &&
    cleanEmail === ADMIN_EMAIL &&
    String(password) === process.env.ADMIN_PASSWORD
  ) {
    log("admin ADMIN_PASSWORD fallback engaged — provisioning admin account");
    user = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        passwordHash: hashPassword(process.env.ADMIN_PASSWORD),
        role: "admin",
        emailVerified: true,
      },
      create: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash: hashPassword(process.env.ADMIN_PASSWORD),
        role: "admin",
        emailVerified: true,
      },
      select: AUTH_SELECT,
    });
    passOk = true;
  }

  if (!user || !passOk) {
    log("REJECT: invalid credentials");
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Email verification gate — CLIENTS only. Admins are never blocked.
  if (user.role !== "admin" && !user.emailVerified) {
    log("REJECT: client email not verified");
    return NextResponse.json(
      { error: "Please verify your email first.", unverified: true, email: user.email },
      { status: 403 }
    );
  }

  // One-time backfill so existing users get a username (and the claim banner).
  // Fire-and-forget — never delays or blocks login.
  void ensureUsernamesBackfilledOnce();

  const session: Session = {
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    name: user.name,
    clientId: user.clientId,
    emailVerified: user.emailVerified,
    iat: Date.now(), // immutable login time → drives the hard session cap
  };

  // Landing target: a client who hasn't funded yet (balance $0 → no tier) lands
  // on QX Tiers to pick a package; everyone else goes to the dashboard.
  let redirectTo = "/dashboard";
  if (user.role === "client" && user.clientId) {
    const perf = await getClientPerformance(user.clientId).catch(() => null);
    if ((perf?.kpis.currentBalance ?? 0) <= 0) redirectTo = "/qx-tiers";
  }

  const res = NextResponse.json({ ok: true, role: session.role, redirectTo });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // HTTPS-only in prod
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  log(`SUCCESS role=${user.role} email=${user.email}`);
  return res;
}
