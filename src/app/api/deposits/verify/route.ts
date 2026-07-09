import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { verifyPendingDeposits } from "@/lib/verify-deposits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await verifyPendingDeposits());
}

export const GET = handle;
export const POST = handle;
