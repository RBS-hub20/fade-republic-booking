/**
 * Lightweight in-memory rate limiter (fixed window). No dependencies.
 *
 * NOTE: state lives in the process, so on serverless it is per-instance and
 * resets on cold start. It meaningfully slows brute-force / abuse on a single
 * instance, but for strict multi-instance limits use a shared store
 * (e.g. Upstash Redis) — swap `hit()` for a Redis INCR + EXPIRE.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map doesn't grow unbounded.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  Array.from(buckets.entries()).forEach(([k, b]) => {
    if (b.resetAt <= now) buckets.delete(k);
  });
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter };
  }
  return { ok: true, remaining: limit - existing.count, retryAfter };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Convenience: apply a limit and return a 429 Response when exceeded, else null.
 * Usage:  const limited = enforce(req, "login", 8, 15 * 60_000); if (limited) return limited;
 */
export function enforce(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number
): Response | null {
  const { ok, retryAfter } = rateLimit(`${scope}:${clientIp(req)}`, limit, windowMs);
  if (ok) return null;
  return new Response(
    JSON.stringify({ error: "Too many attempts. Please try again later." }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    }
  );
}
