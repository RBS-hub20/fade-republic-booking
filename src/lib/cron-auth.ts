import { getSession } from "./auth";

/**
 * Authorization for cron / maintenance endpoints.
 *
 *  - If CRON_SECRET is NOT set → open. This lets the Vercel Cron and manual
 *    admin testing work out of the box. Set CRON_SECRET to lock it down.
 *  - If CRON_SECRET IS set → require the Vercel Cron bearer token OR an
 *    authenticated admin session.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return getSession()?.role === "admin";
}
