import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMyTeam } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A member's OWN direct downline (privacy: only their referrals). Session-gated;
 * the userId always comes from the signed session, never from the request, so a
 * member can only ever see their own team.
 *
 * Query: ?page=1&filter=all|bought|pending&q=<username>
 */
export async function GET(req: Request) {
  const session = getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const filterParam = url.searchParams.get("filter");
  const filter = filterParam === "bought" || filterParam === "pending" ? filterParam : "all";
  const q = url.searchParams.get("q") ?? "";

  const data = await getMyTeam(session.userId, { page, filter, q });
  return NextResponse.json({ ok: true, ...data });
}
