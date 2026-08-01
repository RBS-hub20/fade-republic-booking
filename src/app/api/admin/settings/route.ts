import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setBoolFlag, getBoolFlags, FLAG_BONUS_MODAL, FLAG_SHANGHAI_MODAL } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = [FLAG_BONUS_MODAL, FLAG_SHANGHAI_MODAL];

/** Admin-only: toggle a celebration feature flag. Body: { key, value:boolean }. */
export async function POST(req: Request) {
  if (getSession()?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { key, value } = await req.json().catch(() => ({}));
  if (!ALLOWED.includes(key) || typeof value !== "boolean") {
    return NextResponse.json({ error: "Invalid key or value" }, { status: 400 });
  }
  await setBoolFlag(key, value);
  const flags = await getBoolFlags(ALLOWED);
  return NextResponse.json({ ok: true, flags });
}
