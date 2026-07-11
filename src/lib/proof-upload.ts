"use client";

import { upload } from "@vercel/blob/client";

export interface ProofUploadInput {
  kind: "withdrawal" | "deposit";
  refId: string;
  network?: string;
  txHash?: string;
  file: File;
}

/**
 * Upload a proof screenshot/PDF straight to Vercel Blob (client-direct, so the
 * 5MB file never passes through a serverless function). Authorization + the
 * DB record happen in /api/proofs/upload. Returns the blob pathname on success.
 */
export async function uploadProof({ kind, refId, network, txHash, file }: ProofUploadInput): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const result = await upload(`proofs/${kind}/${refId}/${Date.now()}-${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/proofs/upload",
    contentType: file.type || undefined,
    clientPayload: JSON.stringify({ kind, refId, network, txHash, name: file.name, size: file.size }),
  });
  return result.pathname;
}
