import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setExclusiveActivation, searchExclusiveUsers, type ActivationType } from "@/lib/exclusive";
import type { TierId } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only: search members for the Exclusive Network table. ?q=email|username */
export async function GET(req: Request) {
  if (getSession()?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const rows = await searchExclusiveUsers(q);
  return NextResponse.json({ ok: true, rows });
}

/**
 * Admin-only: activate/clear a member's exclusive status.
 * Body: { userId, activationType: "STANDARD"|"NETWORK_ONLY", packageTierId?, note? }
 */
export async function POST(req: Request) {
  if (getSession()?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const activationType = body.activationType as ActivationType;
  if (!userId || (activationType !== "STANDARD" && activationType !== "NETWORK_ONLY")) {
    return NextResponse.json({ error: "Invalid userId or activationType" }, { status: 400 });
  }

  const result = await setExclusiveActivation({
    userId,
    activationType,
    packageTierId: body.packageTierId as TierId | undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, saved: result.saved });
}
