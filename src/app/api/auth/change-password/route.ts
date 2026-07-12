import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordMeetsPolicy } from "@/lib/password-strength";
import { rateLimit } from "@/lib/rate-limit";
import { notifyPasswordChanged } from "@/lib/mailers";
import { TOKEN_TYPES } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-service password change for a signed-in user.
 *
 * Security:
 *  - Requires an authenticated session AND the correct CURRENT password (this
 *    re-auth is the gate — there is no 2FA in the product yet).
 *  - Rate limited to 5 attempts per hour PER USER.
 *  - Enforces the password policy (8+, upper, number, special).
 *  - Emails the user a "password changed" notice and logs the event.
 */
export async function POST(req: Request) {
  const session = getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // 5 attempts / hour, per user (not per IP) — protects against a hijacked tab
  // brute-forcing the current password.
  const { ok, retryAfter } = rateLimit(`change-password:${session.userId}`, 5, 60 * 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new password are required." },
      { status: 400 }
    );
  }
  if (!passwordMeetsPolicy(String(newPassword))) {
    return NextResponse.json(
      { error: "New password must be 8+ characters with an uppercase letter, a number, and a special character." },
      { status: 400 }
    );
  }
  if (String(newPassword) === String(currentPassword)) {
    return NextResponse.json(
      { error: "Your new password must be different from your current password." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (!verifyPassword(String(currentPassword), user.passwordHash)) {
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(String(newPassword)) },
    }),
    // Invalidate any outstanding password-reset links now that it's changed.
    prisma.authToken.deleteMany({
      where: { userId: user.id, type: TOKEN_TYPES.PASSWORD_RESET },
    }),
  ]);

  // Audit log (structured; no secrets).
  console.log(`[security] password changed userId=${user.id} at=${new Date().toISOString()}`);

  // Best-effort "your password changed" email — never block the response.
  notifyPasswordChanged({ email: user.email, name: user.name }).catch(() => {});

  return NextResponse.json({ ok: true });
}
