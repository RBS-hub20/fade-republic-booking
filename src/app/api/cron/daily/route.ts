import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runDailyPerformance } from "@/lib/daily-performance";
import { verifyPendingDeposits } from "@/lib/verify-deposits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Authorized by the Vercel Cron secret OR an admin session. */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return getSession()?.role === "admin";
}

/**
 * Single daily cron — scheduled for 23:59 Asia/Manila (15:59 UTC).
 *
 * Combines both daily jobs into ONE Vercel Cron entry (keeps us within the
 * Hobby plan's cron limits): records/backfills client daily performance, and
 * sweeps pending on-chain deposits. Both steps are independent and best-effort.
 */
async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: Record<string, unknown> = { at: new Date().toISOString() };
  try {
    result.performance = await runDailyPerformance();
  } catch (err: any) {
    result.performance = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  try {
    result.deposits = await verifyPendingDeposits();
  } catch (err: any) {
    result.deposits = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
