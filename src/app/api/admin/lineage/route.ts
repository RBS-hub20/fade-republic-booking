import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUpline, findUserByIdOrEmail } from "@/lib/genealogy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Full upline chain (root → user) for a user.
 *   GET /api/admin/lineage?userId=<id>   or  ?query=<id-or-email>
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

  const upline = await getUpline(found.id);
  return NextResponse.json({ userId: found.id, upline });
}
