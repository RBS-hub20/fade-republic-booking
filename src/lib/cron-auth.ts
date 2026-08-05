import { getSession } from "./auth";

let warnedNoSecret = false;

/**
 * Authorization for cron / maintenance endpoints.
 *
 *  - If CRON_SECRET is NOT set → open (fail-OPEN), and we log a one-time warning
 *    so it's visible that the endpoints are unprotected. This keeps Vercel Cron
 *    and manual admin testing working out of the box until the secret is set.
 *  - If CRON_SECRET IS set → require the Vercel Cron bearer token OR an
 *    authenticated admin session (fail-CLOSED to the public).
 *
 * NOTE: /api/cron/* is exempted from the session-cookie middleware (it enforces
 * its own auth here), so Vercel Cron — which carries no session — can reach it.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn(
        "[cron-auth] CRON_SECRET is not set — cron/maintenance endpoints are PUBLIC. " +
          "Set CRON_SECRET in the environment to require Authorization: Bearer <CRON_SECRET>."
      );
    }
    return true;
  }
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return getSession()?.role === "admin";
}
