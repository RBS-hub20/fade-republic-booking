import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { applyReferralSchema } from "@/lib/referral-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-shot, idempotent runtime migration for the referral schema.
 *
 * Runs the referral DDL over the app's live DATABASE_URL — the connection the
 * app actually uses — which is reachable even when the Vercel BUILD environment
 * can't reach the DB over DIRECT_URL (the reason the build-time push/guard can
 * silently fail on some hosted Postgres setups).
 *
 * Admin-only. Safe to call repeatedly (all DDL is IF NOT EXISTS).
 *
 *   GET /api/referrals/migrate   (signed in as admin)
 */
export async function GET() {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required. Sign in as an admin, then open this URL again." },
      { status: 403 }
    );
  }

  try {
    const result = await applyReferralSchema(prisma);

    // Re-check readiness after applying.
    const readiness = { userColumns: false, commissionTable: false, withdrawalTable: false };
    try {
      await prisma.user.findFirst({ select: { referralCode: true } });
      readiness.userColumns = true;
    } catch {
      /* still missing */
    }
    try {
      await prisma.referralCommission.count();
      readiness.commissionTable = true;
    } catch {
      /* still missing */
    }
    try {
      await prisma.commissionWithdrawal.count();
      readiness.withdrawalTable = true;
    } catch {
      /* still missing */
    }

    const ready =
      readiness.userColumns && readiness.commissionTable && readiness.withdrawalTable;

    return NextResponse.json({
      ok: ready,
      applied: result.applied,
      failures: result.failures,
      readiness,
      message: ready
        ? "Referral schema is ready. Clients will now see the referral card."
        : "Some referral schema is still missing — see failures.",
      at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[api/referrals/migrate] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message?.split("\n")[0] ?? "Migration failed." },
      { status: 500 }
    );
  }
}
