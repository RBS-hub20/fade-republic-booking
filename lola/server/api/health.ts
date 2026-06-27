import { createApp } from "../src/app.js";

/**
 * Vercel serverless function: GET /api/health.
 *
 * Typed structurally (no @vercel/node dependency required) so it stays portable.
 * The real orchestration lives in the shared app router.
 */
interface MinimalReq {
  method?: string;
  url?: string;
}
interface MinimalRes {
  status(code: number): MinimalRes;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

const app = createApp();

export default function handler(req: MinimalReq, res: MinimalRes): void {
  const result = app.handle(req.method ?? "GET", req.url ?? "/api/health");
  res.setHeader("access-control-allow-origin", "*");
  res.status(result.status).json(result.body);
}
