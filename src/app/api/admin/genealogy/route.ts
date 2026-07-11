import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { enforce } from "@/lib/rate-limit";
import {
  getChildren,
  getRootDirectCount,
  resolvePath,
  ensureAvatarsBackfilledOnce,
  PAGE_SIZE,
} from "@/lib/genealogy-tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only genealogy tree data for the admin visualizer.
 *   GET /api/admin/genealogy?parentId=root&offset=0        → children page
 *   GET /api/admin/genealogy?path=<username>               → root→user chain
 *   GET /api/admin/genealogy?meta=1                         → root direct count
 * Admin only · 30 requests/min per admin.
 */
export async function GET(req: Request) {
  if (getSession()?.role !== "admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const limited = enforce(req, "admin-genealogy", 30, 60_000);
  if (limited) return limited;

  const url = new URL(req.url);
  try {
    // Best-effort one-time avatar backfill so nodes always have an avatar.
    void ensureAvatarsBackfilledOnce();

    if (url.searchParams.get("meta") === "1") {
      return NextResponse.json({ rootDirectCount: await getRootDirectCount() });
    }

    const path = url.searchParams.get("path");
    if (path) return NextResponse.json(await resolvePath(path.trim()));

    const parentId = (url.searchParams.get("parentId") || "root").trim();
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
    const limit = Math.min(PAGE_SIZE, Math.max(1, Number(url.searchParams.get("limit") || PAGE_SIZE) || PAGE_SIZE));
    return NextResponse.json(await getChildren(parentId, offset, limit));
  } catch (err: any) {
    console.error("[admin/genealogy] error:", err);
    return NextResponse.json({ error: "Failed to load tree." }, { status: 500 });
  }
}
