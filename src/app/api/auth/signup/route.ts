import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/auth-config";
import { hashPassword } from "@/lib/password";
import { createAndSendVerification } from "@/lib/mailers";
import { enforce } from "@/lib/rate-limit";
import { findReferrerByCode, ensureReferralCode } from "@/lib/referrals";
import { REFERRALS_ENABLED } from "@/lib/referrals-config";
import { ensureReferralSchemaOnce } from "@/lib/referral-schema";
import { computeGenealogyForSponsor } from "@/lib/genealogy";
import {
  normalizeUsername,
  validateUsernameFormat,
  isUsernameAvailable,
  ensureUsernameSchemaOnce,
} from "@/lib/username";
import { normalizeGender, avatarTypeFor, ensureAvatarSchemaOnce } from "@/lib/avatar";

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
 * The new account starts UNVERIFIED and is NOT logged in — the user must verify
 * their email before they can sign in. We return the email so the client can
 * redirect to the "check your inbox" page.
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

  const { name, email, password, phone, ref, username, gender } = await req.json().catch(() => ({}));
  const cleanGender = normalizeGender(gender);

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

  const cleanUsername = normalizeUsername(String(username ?? ""));
  const uFmt = validateUsernameFormat(cleanUsername);
  if (!uFmt.ok) return NextResponse.json({ error: uFmt.error }, { status: 400 });

  const cleanEmail = String(email).toLowerCase().trim();

  // ---- Create the account (this is the only part that can fail signup) ----
  let user;
  try {
    // The User model carries referral columns. If a lagging migration means they
    // don't exist yet on this DB, Prisma's INSERT/SELECT RETURNING would throw
    // (P2022) and break signup. Self-heal the schema once over the live
    // connection before touching the User table.
    await ensureReferralSchemaOnce(prisma);
    await ensureUsernameSchemaOnce(prisma);
    await ensureAvatarSchemaOnce(prisma);

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }

    if (!(await isUsernameAvailable(cleanUsername))) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    let accountNumber = await nextAccountNumber();
    if (await prisma.client.findUnique({ where: { accountNumber } })) {
      accountNumber = `QX-${Date.now().toString().slice(-6)}`;
    }

    // Resolve the referrer (if a valid ?ref= code was supplied). Never let a
    // referral hiccup block signup.
    let referredById: string | null = null;
    if (REFERRALS_ENABLED && ref) {
      referredById = await findReferrerByCode(String(ref)).catch(() => null);
    }

    // Materialize the new user's lineage (path/depth/root) from their sponsor.
    const genealogy = await computeGenealogyForSponsor(referredById).catch(() => ({
      referralPath: null,
      referralDepth: 0,
      rootSponsorId: null,
    }));

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
          referredById,
          referralPath: genealogy.referralPath,
          referralDepth: genealogy.referralDepth,
          rootSponsorId: genealogy.rootSponsorId,
          username: cleanUsername,
          usernameSet: true, // new users choose their username at signup
          gender: cleanGender,
        },
      });
    });

    // Give the new user their own referral code up front (best-effort).
    ensureReferralCode({ id: user.id, name: user.name, referralCode: null }).catch(() => {});
    // Assign the permanent avatar (needs the generated id). Best-effort — the
    // tree also backfills any nulls.
    prisma.user
      .update({ where: { id: user.id }, data: { avatarType: avatarTypeFor(cleanGender, user.id) } })
      .catch(() => {});
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

  // No session — the user must verify their email before signing in.
  return NextResponse.json({
    ok: true,
    email: user.email,
    ...(devLink ? { devLink } : {}),
  });
}
