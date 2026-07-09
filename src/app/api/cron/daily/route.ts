import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cronAuthorized } from "@/lib/cron-auth";
import { runDailyPerformance } from "@/lib/daily-performance";
import { verifyPendingDeposits } from "@/lib/verify-deposits";
import { runMaturityNotifications } from "@/lib/capital";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";

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
  try {
    await ensureFinanceSchemaOnce(prisma);
    result.maturity = await runMaturityNotifications();
  } catch (err: any) {
    result.maturity = { ok: false, error: err?.message?.split("\n")[0] ?? "failed" };
  }
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
