import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDownlines, findUserByIdOrEmail } from "@/lib/genealogy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * All downlines under a user (any depth), with per-level counts + volume.
 *   GET /api/admin/downlines?userId=<id>   or  ?query=<id-or-email>
 */
export async function GET(req: Request) {
  if (getSession()?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("userId") || url.searchParams.get("query") || "").trim();
  if (!q) return NextResponse.json({ error: "Provide a userId or email." }, { status: 400 });

  const found = await findUserByIdOrEmail(q);
  if (!found) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const result = await getDownlines(found.id);
  return NextResponse.json(result);
}
