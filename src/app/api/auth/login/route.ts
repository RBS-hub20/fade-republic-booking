import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, type Session, type Role } from "@/lib/auth-config";
import { encodeSession } from "@/lib/session";
import { verifyPassword, hashPassword } from "@/lib/password";
import { enforce } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@quantumxglobal.com").toLowerCase().trim();
const ADMIN_NAME = process.env.ADMIN_NAME || "Portfolio Admin";

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
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  const cleanEmail = String(email).toLowerCase().trim();

  if (!process.env.SESSION_SECRET) {
    log("WARNING: SESSION_SECRET is not set — using an insecure dev fallback secret.");
  }

  let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
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

  const session: Session = {
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    name: user.name,
    clientId: user.clientId,
    emailVerified: user.emailVerified,
  };

  const res = NextResponse.json({ ok: true, role: session.role });
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
