import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runDailyPerformance } from "@/lib/daily-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily performance cron — scheduled for 23:59 Asia/Manila (15:59 UTC).
 * Records/backfills each funded client's compounded daily return. Admins can
 * also call it on demand (e.g. to backfill immediately).
 */
async function handle(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDailyPerformance());
  } catch (err: any) {
    console.error("[cron/daily-performance] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message?.split("\n")[0] ?? "Daily performance run failed." },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
