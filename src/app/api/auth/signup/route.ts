import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, isValidEmail, type Session } from "@/lib/auth-config";
import { encodeSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { createAndSendVerification } from "@/lib/mailers";
import { enforce } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate a unique-ish account number like QX-10042. */
async function nextAccountNumber(): Promise<string> {
  const count = await prisma.client.count();
  return `QX-${10001 + count}`;
}

/** Resolve `p`, or `fallback` if it doesn't settle within `ms`. Never rejects. */
async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Real signup: creates a trading Client + a linked client-role User with a
 * hashed password, then issues a signed session.
 *
 * The verification email is best-effort and fully decoupled: once the account
 * is created we ALWAYS return success. Email is bounded by a timeout and its
 * errors are logged, never surfaced — so a slow/failing Resend call can never
 * make signup fail (previously it could time out the whole request).
 */
export async function POST(req: Request) {
  // 5 signups / hour per IP.
  const limited = enforce(req, "signup", 5, 60 * 60_000);
  if (limited) return limited;

  const { name, email, password, phone } = await req.json().catch(() => ({}));

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email and password are all required" },
      { status: 400 }
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const cleanEmail = String(email).toLowerCase().trim();

  // ---- Create the account (this is the only part that can fail signup) ----
  let user;
  try {
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }

    let accountNumber = await nextAccountNumber();
    if (await prisma.client.findUnique({ where: { accountNumber } })) {
      accountNumber = `QX-${Date.now().toString().slice(-6)}`;
    }

    user = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: String(name).trim(),
          email: cleanEmail,
          phone: phone ? String(phone).trim() : null,
          accountNumber,
          initialDeposit: 0,
          startDate: new Date(),
          status: "ACTIVE",
        },
      });
      return tx.user.create({
        data: {
          email: cleanEmail,
          name: String(name).trim(),
          passwordHash: hashPassword(String(password)),
          role: "client",
          clientId: client.id,
        },
      });
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "That email or account already exists" }, { status: 409 });
    }
    console.error("Signup failed to create account:", e);
    return NextResponse.json({ error: "Could not create account. Please try again." }, { status: 500 });
  }

  // ---- Account exists. From here we ALWAYS return success. ----
  // Verification email is best-effort, bounded, and never blocks/fails signup.
  let devLink: string | undefined;
  try {
    const result = await withTimeout(createAndSendVerification(user), 6000, {} as { devLink?: string });
    devLink = result.devLink;
  } catch (err) {
    console.error("Verification email error (ignored):", err);
  }

  const session: Session = {
    userId: user.id,
    email: user.email,
    role: "client",
    name: user.name,
    clientId: user.clientId,
  };

  const res = NextResponse.json({ ok: true, role: "client", ...(devLink ? { devLink } : {}) });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
