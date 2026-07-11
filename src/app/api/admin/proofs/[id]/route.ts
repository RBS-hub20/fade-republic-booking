import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureProofSchemaOnce } from "@/lib/proof-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-gated proof viewer/downloader. The blob URL is never exposed to the
 * browser — admins fetch the file through this authenticated route, which
 * streams it back. `?download=1` forces a download.
 *   GET /api/admin/proofs/[id]
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (getSession()?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureProofSchemaOnce(prisma);

  const proof = await prisma.proofFile.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!proof) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const upstream = await fetch(proof.url).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = (proof.originalName || `proof-${proof.id}`).replace(/[^\w.\-]+/g, "_");
  return new Response(upstream.body, {
    headers: {
      "Content-Type": proof.contentType || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
