import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/auth-config";
import { generateToken, appBaseUrl, TOKEN_TYPES } from "@/lib/tokens";
import { sendEmail, emailConfigured, emailTemplate } from "@/lib/email";
import { enforce } from "@/lib/rate-limit";

const ONE_HOUR = 60 * 60 * 1000;

/**
 * Start a password reset. Always returns a generic success (never reveals
 * whether an account exists). When no email provider is configured AND we're not
 * in production, returns a `devLink` so the flow is testable locally.
 */
export async function POST(req: Request) {
  // 5 requests / 15 min per IP.
  const limited = enforce(req, "forgot", 5, 15 * 60_000);
  if (limited) return limited;

  const { email } = await req.json().catch(() => ({}));
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const clean = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: clean } });

  let devLink: string | undefined;

  if (user) {
    // Invalidate previous reset tokens for this user.
    await prisma.authToken.deleteMany({
      where: { userId: user.id, type: TOKEN_TYPES.PASSWORD_RESET },
    });

    const { raw, hash } = generateToken();
    await prisma.authToken.create({
      data: {
        userId: user.id,
        type: TOKEN_TYPES.PASSWORD_RESET,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + ONE_HOUR),
      },
    });

    const link = `${appBaseUrl()}/reset-password?token=${raw}`;
    const result = await sendEmail({
      to: clean,
      subject: "Reset your QuantumX password",
      html: emailTemplate({
        heading: "Reset your password",
        body: "We received a request to reset your password. This link expires in 1 hour. If you didn't request it, you can ignore this email.",
        buttonLabel: "Reset password",
        buttonUrl: link,
      }),
    });

    // Only expose the link locally when no provider is configured.
    if (!result.delivered && !emailConfigured() && process.env.NODE_ENV !== "production") {
      devLink = link;
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
    ...(devLink ? { devLink } : {}),
  });
}
