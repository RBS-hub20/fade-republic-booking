import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cronAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { ensureReferralSchemaOnce } from "@/lib/referral-schema";
import { backfillGenealogy } from "@/lib/genealogy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rebuild referralPath/referralDepth/rootSponsorId for ALL users from the
 * referredById graph. Idempotent. Admin session or cron bearer.
 *   POST /api/admin/genealogy/backfill
 */
export async function POST(req: Request) {
  if (getSession()?.role !== "admin" && !cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureReferralSchemaOnce(prisma);
    const result = await backfillGenealogy();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message?.split("\n")[0] ?? "backfill failed" },
      { status: 500 }
    );
  }
}
