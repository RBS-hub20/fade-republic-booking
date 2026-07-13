import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { markTodayNoTrading, getTodayPostingStatus } from "@/lib/daily-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin "Mark Today as No Trading Day" — posts a 0.00% P/L entry for TODAY for
 * every eligible client that isn't already posted (holidays, weekends,
 * maintenance, flat days). Idempotent; never overwrites a real posted %. Once
 * today is posted, the nightly cron + self-heal both skip it, so it stays flat.
 * Authorized for an admin session or the cron bearer token.
 *
 *   POST /api/admin/no-trading-day
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await markTodayNoTrading();
    const status = await getTodayPostingStatus();
    return NextResponse.json({ ok: true, result, status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message?.split("\n")[0] ?? "mark no-trading failed" },
      { status: 500 }
    );
  }
}
