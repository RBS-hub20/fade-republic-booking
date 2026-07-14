import { NextResponse } from "next/server";
import { normalizeCountry, countryName, countryTimezone, DEFAULT_COUNTRY } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Best-effort IP → country for pre-selecting the signup country field.
 *
 * On Vercel, the edge injects `x-vercel-ip-country` (ISO alpha-2) for every
 * request — no external API or key needed. We normalize it to a supported
 * selector code (GB→UK, unlisted→OTHER) and return the matching display name +
 * primary timezone. Falls back to PH when the header is absent (e.g. local dev).
 * The user can always change the selection, so this is a hint, not a lock.
 *
 *   GET /api/geoip  → { country, countryName, timezone, detected }
 */
export async function GET(req: Request) {
  const detected =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") || // Cloudflare fallback, if ever proxied
    "";
  const country = detected ? normalizeCountry(detected) : DEFAULT_COUNTRY;
  return NextResponse.json({
    country,
    countryName: countryName(country),
    timezone: countryTimezone(country),
    detected: detected || null,
  });
}
