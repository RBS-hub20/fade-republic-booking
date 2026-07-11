import { NextResponse } from "next/server";
import { getDailyPerfHealth } from "@/lib/daily-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily P/L health check. Reports the last posted day, the expected day, and
 * whether any funded client is missing yesterday's entry.
 *
 *   GET /api/health/daily-pl  → 200 when healthy, 503 when stale/degraded.
 */
export async function GET() {
  try {
    const health = await getDailyPerfHealth();
    return NextResponse.json(health, { status: health.ok ? 200 : 503 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.code ? `${err.code}` : "health check failed" },
      { status: 503 }
    );
  }
}
