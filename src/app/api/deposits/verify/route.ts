import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyPendingDeposits } from "@/lib/verify-deposits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Authorized by the Vercel Cron secret OR an admin session. */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return getSession()?.role === "admin";
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await verifyPendingDeposits());
}

export const GET = handle;
export const POST = handle;
