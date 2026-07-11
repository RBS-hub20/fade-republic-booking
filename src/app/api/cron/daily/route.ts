import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cronAuthorized } from "@/lib/cron-auth";
import { runDailyPerformanceResilient, getDailyPerfHealth } from "@/lib/daily-performance";
import { verifyPendingDeposits } from "@/lib/verify-deposits";
import { runMaturityNotifications } from "@/lib/capital";
import { recomputeAllUnlocks, runMonthlyReferralBonus } from "@/lib/referrals";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";
import { notifyDailyPerfIssue } from "@/lib/mailers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Single daily cron — scheduled for 23:59 Asia/Manila (15:59 UTC).
 *
 * Combines both daily jobs into ONE Vercel Cron entry (keeps us within the
 * Hobby plan's cron limits): records/backfills client daily performance, and
 * sweeps pending on-chain deposits. Both steps are independent and best-effort.
 */
async function handle(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: Record<string, unknown> = { at: new Date().toISOString() };
  let perfFailed = false;
  try {
    // Retries within the invocation; any residual gap self-heals next run.
    result.performance = await runDailyPerformanceResilient();
  } catch (err: any) {
    perfFailed = true;
    result.performance = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  // Health check + admin alert: if the run errored or any funded client is
  // still missing yesterday's entry, email the admin so it never goes unnoticed.
  try {
    const health = await getDailyPerfHealth();
    result.perfHealth = health;
    if (perfFailed || health.stale) {
      await notifyDailyPerfIssue({
        detail: perfFailed
          ? "The daily P/L job threw an error during this run (retries exhausted)."
          : "Some funded clients are still missing yesterday's P/L entry after this run.",
        lastPosted: health.lastPostedKey,
        expected: health.yesterdayKey,
        clientsAffected: health.clientsBehind,
      }).catch(() => {});
    }
  } catch (err: any) {
    result.perfHealth = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  try {
    result.deposits = await verifyPendingDeposits();
  } catch (err: any) {
    result.deposits = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  try {
    await ensureFinanceSchemaOnce(prisma);
    result.maturity = await runMaturityNotifications();
  } catch (err: any) {
    result.maturity = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  try {
    result.unlocks = await recomputeAllUnlocks();
  } catch (err: any) {
    result.unlocks = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  // Monthly direct-referral bonus for the previous month — idempotent per
  // (user, month), so running it daily pays it once on the first run of a new
  // month (keeps us on Hobby's single cron slot).
  try {
    result.monthlyBonus = await runMonthlyReferralBonus();
  } catch (err: any) {
    result.monthlyBonus = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
