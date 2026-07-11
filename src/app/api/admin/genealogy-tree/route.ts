import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGenealogyTree, findUserByIdOrEmail } from "@/lib/genealogy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whole subtree under a root/user for visualization.
 *   GET /api/admin/genealogy-tree?rootId=<id>   or  ?query=<id-or-email>
 */
export async function GET(req: Request) {
  if (getSession()?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("rootId") || url.searchParams.get("query") || "").trim();
  if (!q) return NextResponse.json({ error: "Provide a rootId or email." }, { status: 400 });

  const found = await findUserByIdOrEmail(q);
  if (!found) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const tree = await getGenealogyTree(found.id);
  return NextResponse.json({ rootId: found.id, tree });
}
