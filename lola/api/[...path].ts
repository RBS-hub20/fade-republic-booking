import { createApp } from "../server/src/app.js";

/**
 * Vercel catch-all serverless function, living at the workspace root so Vercel's
 * install resolves the @lola/shared workspace package. Every request under
 * /api/* lands here; we strip the /api prefix and delegate to the shared app
 * router, so the dev server and Vercel run identical logic.
 *
 * Typed structurally (no @vercel/node dependency required).
 *
 * NOTE: serverless invocations are stateless and the local filesystem is
 * ephemeral, so the file-backed session store does NOT persist across requests
 * in production — configure Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * for durable transcripts when deploying.
 */
interface MinimalReq {
  method?: string;
  url?: string;
  body?: unknown;
}
interface MinimalRes {
  status(code: number): MinimalRes;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
}

const app = createApp();

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");

  if ((req.method ?? "GET").toUpperCase() === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const url = req.url ?? "/";
  const path = url.replace(/^\/api(?=\/|$)/, "") || "/";

  const result = await app.handle(req.method ?? "GET", path, req.body);
  res.status(result.status).json(result.body);
}
