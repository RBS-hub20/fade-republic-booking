import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/auth-config";
import { createAndSendVerification } from "@/lib/mailers";
import { enforce } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public "resend verification email" by email address (no session required).
 * Used by the post-signup pending page and the "verify first" login block.
 * Always returns a generic success and never reveals whether an account exists.
 * In dev with no email provider, returns a `devLink` for local testing.
 */
export async function POST(req: Request) {
  // 5 resends / 15 min per IP.
  const limited = enforce(req, "resend", 5, 15 * 60_000);
  if (limited) return limited;

  const { email } = await req.json().catch(() => ({}));
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const clean = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: clean } });

  let devLink: string | undefined;
  if (user && !user.emailVerified) {
    try {
      ({ devLink } = await createAndSendVerification(user));
    } catch (err) {
      console.error("Resend verification failed:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that account exists and is unverified, a new link has been sent.",
    ...(devLink ? { devLink } : {}),
  });
}
