import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runMonthlyReferralBonus } from "@/lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Monthly direct-referral bonus — pays 5% of each earner's qualifying direct
 * referrals' Daily P/L for the previous calendar month, to Available Withdrawal.
 * Idempotent per (user, month). Pass ?month=YYYY-MM to (re)run a specific month.
 *
 * Also invoked from the daily cron so it fires on Hobby's single cron slot.
 */
async function handle(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const month = new URL(req.url).searchParams.get("month") ?? undefined;
    const result = await runMonthlyReferralBonus(month ? { monthYear: month } : undefined);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[cron/monthly-referral-bonus] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message?.split("\n")[0] ?? "Monthly bonus run failed." },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
