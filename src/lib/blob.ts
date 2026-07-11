/**
 * Vercel Blob availability. Server-only (reads process.env) — pass the boolean
 * down to client components so the proof-upload UI hides itself gracefully when
 * no Blob store is connected yet (BLOB_READ_WRITE_TOKEN unset).
 */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
