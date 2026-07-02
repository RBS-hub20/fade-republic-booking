import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createAndSendVerification } from "@/lib/mailers";

/** Resend the verification email to the currently logged-in user. */
export async function POST() {
  const session = getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const { devLink } = await createAndSendVerification(user);
  return NextResponse.json({ ok: true, ...(devLink ? { devLink } : {}) });
}
