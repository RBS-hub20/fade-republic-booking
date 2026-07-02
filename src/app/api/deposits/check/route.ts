import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyPendingDeposits } from "@/lib/verify-deposits";
import { enforce } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Client-triggered verification of the caller's OWN pending USDT deposits.
 * Lets the wallet page confirm deposits in near-real-time on any plan (no
 * dependency on the cron cadence). Rate-limited.
 */
export async function POST(req: Request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.clientId) {
    return NextResponse.json({ error: "No trading account linked" }, { status: 400 });
  }

  // 12 checks / minute per IP (client polls ~every 18s).
  const limited = enforce(req, "depcheck", 12, 60_000);
  if (limited) return limited;

  const result = await verifyPendingDeposits({ clientId: session.clientId });
  return NextResponse.json({ ok: true, approved: result.approved, checked: result.checked });
}
