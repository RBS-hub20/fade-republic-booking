import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, isValidEmail, type Session } from "@/lib/auth-config";
import { encodeSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";

/** Generate a unique-ish account number like QX-10042. */
async function nextAccountNumber(): Promise<string> {
  const count = await prisma.client.count();
  return `QX-${10001 + count}`;
}

/**
 * Real signup: creates a trading Client + a linked client-role User with a
 * hashed password, then issues a signed session. New accounts start with a
 * zero balance and no performance history (until they deposit).
 */
export async function POST(req: Request) {
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

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  try {
    let accountNumber = await nextAccountNumber();
    // Guard against a rare race on the account number.
    if (await prisma.client.findUnique({ where: { accountNumber } })) {
      accountNumber = `QX-${Date.now().toString().slice(-6)}`;
    }

    const user = await prisma.$transaction(async (tx) => {
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

    const session: Session = {
      userId: user.id,
      email: user.email,
      role: "client",
      name: user.name,
      clientId: user.clientId,
    };

    const res = NextResponse.json({ ok: true, role: "client" });
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "That email or account already exists" }, { status: 409 });
    }
    console.error("Signup failed:", e);
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }
}
