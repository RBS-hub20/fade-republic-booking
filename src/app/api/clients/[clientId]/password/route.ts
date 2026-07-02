import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

/** Human-friendly random password (no ambiguous characters). */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * Admin: set (or reset) a client's login password. Provisions a client-role
 * User for the account if one doesn't exist yet (so admin-created clients can
 * be given access). Pass `{ password }` to set a specific one, or omit to have
 * a strong password generated and returned once.
 */
export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const explicit = typeof body.password === "string" ? body.password.trim() : "";
  if (explicit && explicit.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: params.clientId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const password = explicit || generatePassword();
  const passwordHash = hashPassword(password);

  // Prefer the user already linked to this client.
  let user = await prisma.user.findUnique({ where: { clientId: client.id } });

  if (!user) {
    // Fall back to a user with the client's email (link it if unlinked).
    const byEmail = await prisma.user.findUnique({ where: { email: client.email } });
    if (byEmail && byEmail.clientId && byEmail.clientId !== client.id) {
      return NextResponse.json(
        { error: "That email is already linked to another account" },
        { status: 409 }
      );
    }
    user = byEmail;
  }

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, clientId: client.id },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: client.email,
        name: client.name,
        passwordHash,
        role: "client",
        clientId: client.id,
        emailVerified: true,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    email: user.email,
    // Only returned when generated, so the admin can share it once.
    ...(explicit ? {} : { generatedPassword: password }),
  });
}
