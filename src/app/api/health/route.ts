import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FROM_EMAIL, emailConfigured } from "@/lib/resend";
import { REFERRALS_ENABLED } from "@/lib/referrals-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sanitized health/diagnostics endpoint. Reports whether the environment is
 * wired correctly WITHOUT leaking any secrets or connection strings — only
 * booleans, counts, and short error codes. Useful for verifying a deployment.
 *
 *   GET /api/health
 */
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    EMAIL_FROM: FROM_EMAIL,
    emailConfigured: emailConfigured(),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
    ETHERSCAN_API_KEY: Boolean(process.env.ETHERSCAN_API_KEY),
    BSCSCAN_API_KEY: Boolean(process.env.BSCSCAN_API_KEY),
    TRONGRID_API_KEY: Boolean(process.env.TRONGRID_API_KEY),
    GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
  };

  // Which deposit auto-verification paths are enabled.
  const deposits = {
    bep20AutoVerify: Boolean(process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY),
    trc20AutoVerify: true, // TronGrid works without a key
  };

  const db: {
    connected: boolean;
    userTable: boolean;
    userCount?: number;
    clientCount?: number;
    error?: string;
  } = { connected: false, userTable: false };

  try {
    // Connectivity check.
    await prisma.$queryRaw`SELECT 1`;
    db.connected = true;

    // Schema check (does the app's tables exist?).
    try {
      db.userCount = await prisma.user.count();
      db.clientCount = await prisma.client.count();
      db.userTable = true;
    } catch (e: any) {
      db.userTable = false;
      // e.g. P2021 = table does not exist → schema not pushed.
      db.error = e?.code ? `${e.code}: schema not initialized (run prisma db push / redeploy)` : "schema check failed";
    }
  } catch (e: any) {
    // Don't leak host/credentials — report the Prisma code + a friendly hint.
    const code = e?.code as string | undefined;
    const hint =
      code === "P1001"
        ? "cannot reach database server"
        : code === "P1000"
        ? "authentication failed"
        : !process.env.DATABASE_URL
        ? "DATABASE_URL is not set"
        : "database connection failed";
    db.error = code ? `${code}: ${hint}` : hint;
  }

  // Referral readiness — tells us at a glance why the dashboard card may be
  // hidden: flag off, User columns missing, or referral tables not created.
  const referrals: {
    flagEnabled: boolean;
    userColumns: boolean;
    commissionTable: boolean;
    withdrawalTable: boolean;
    ready: boolean;
    error?: string;
  } = {
    flagEnabled: REFERRALS_ENABLED,
    userColumns: false,
    commissionTable: false,
    withdrawalTable: false,
    ready: false,
  };
  if (db.connected) {
    try {
      // Selecting the new column throws (42703) if the migration didn't apply.
      await prisma.user.findFirst({ select: { referralCode: true } });
      referrals.userColumns = true;
    } catch (e: any) {
      referrals.error = e?.code ? `user cols ${e.code}` : "user cols missing";
    }
    try {
      await prisma.referralCommission.count();
      referrals.commissionTable = true;
    } catch {
      /* table missing */
    }
    try {
      await prisma.commissionWithdrawal.count();
      referrals.withdrawalTable = true;
    } catch {
      /* table missing */
    }
    referrals.ready =
      referrals.flagEnabled &&
      referrals.userColumns &&
      referrals.commissionTable &&
      referrals.withdrawalTable;
  }

  const ok = db.connected && db.userTable;
  return NextResponse.json(
    { ok, db, env, deposits, referrals, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}
