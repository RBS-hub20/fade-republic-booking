import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureProofSchemaOnce } from "@/lib/proof-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "application/pdf"];

interface ProofPayload {
  kind: "withdrawal" | "deposit";
  refId: string;
  network?: string;
  txHash?: string;
  name?: string;
  size?: number;
  uploaderId?: string;
  clientId?: string;
}

/**
 * Vercel Blob client-upload handler. Two call shapes hit this route:
 *   1. Browser (blob client) → onBeforeGenerateToken authorizes the upload.
 *   2. Vercel callback (no session) → onUploadCompleted persists the ProofFile.
 * The route is middleware-public; auth for (1) is enforced here via the session,
 * and (2) is authenticated by the signed blob token that handleUpload verifies.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = getSession();
        if (!session?.userId) throw new Error("Sign in to upload proof.");

        let p: ProofPayload;
        try {
          p = JSON.parse(clientPayload || "{}");
        } catch {
          throw new Error("Invalid upload payload.");
        }
        if (p.kind !== "withdrawal" && p.kind !== "deposit") throw new Error("Invalid proof kind.");
        if (!p.refId) throw new Error("Missing reference.");

        // Authorize by kind: admins attach withdrawal payout proof; clients may
        // only attach a deposit proof to their OWN pending deposit.
        if (p.kind === "withdrawal") {
          if (session.role !== "admin") throw new Error("Admin only.");
        } else {
          if (!session.clientId) throw new Error("Client account required.");
          const tx = await prisma.transaction.findUnique({
            where: { id: p.refId },
            select: { clientId: true, type: true },
          });
          if (!tx || tx.clientId !== session.clientId || tx.type !== "DEPOSIT") {
            throw new Error("Deposit not found.");
          }
        }

        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            kind: p.kind,
            refId: p.refId,
            network: p.network ?? null,
            txHash: p.txHash ?? null,
            name: p.name ?? null,
            size: p.size ?? 0,
            uploaderId: session.userId,
            clientId: session.clientId ?? null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        await ensureProofSchemaOnce(prisma);
        const p: ProofPayload = tokenPayload ? JSON.parse(tokenPayload) : ({} as ProofPayload);
        await prisma.proofFile.create({
          data: {
            kind: p.kind,
            refId: p.refId,
            uploaderId: p.uploaderId ?? null,
            clientId: p.clientId ?? null,
            network: p.network ?? null,
            txHash: p.txHash ?? null,
            url: blob.url,
            pathname: blob.pathname,
            contentType: blob.contentType ?? "application/octet-stream",
            size: p.size ?? 0,
            originalName: p.name ?? null,
          },
        });
      },
    });

    return NextResponse.json(json);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Upload failed" }, { status: 400 });
  }
}
