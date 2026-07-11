import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runDailyPerformanceResilient, getDailyPerfHealth } from "@/lib/daily-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin-triggered daily P/L backfill. Runs the same engine as the nightly cron
 * (which fills every missing day from the last logged entry up to today), then
 * returns a fresh health snapshot. Authorized for an admin session or the cron
 * bearer token.
 *
 *   POST /api/admin/backfill-pl
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const performance = await runDailyPerformanceResilient();
    const health = await getDailyPerfHealth();
    return NextResponse.json({ ok: true, performance, health });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message?.split("\n")[0] ?? "backfill failed" },
      { status: 500 }
    );
  }
}
