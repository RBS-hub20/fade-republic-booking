/**
 * Country helpers + schema self-heal for global-expansion signup.
 *
 * The constants/validators are pure and client-safe (no prisma import). The DDL
 * runs at RUNTIME over the live connection (this repo uses `prisma db push` +
 * self-heal, not migrate dev), so the columns provision even when the build
 * can't reach the DB. Mirrors src/lib/phone.ts.
 *
 * `code` is ISO 3166-1 alpha-2, except "UK" (United Kingdom) which we keep to
 * match the product's country selector; Vercel's geo header sends "GB", so
 * `normalizeCountry` aliases GB → UK. "OTHER" is a catch-all for unlisted
 * countries (name "Other", no timezone).
 */

export interface Country {
  code: string;
  flag: string;
  name: string;
  /** Primary IANA timezone for the country (null for OTHER). */
  timezone: string | null;
}

/** Countries offered in the signup selector (order preserved in the UI). */
export const COUNTRIES: Country[] = [
  { code: "PH", flag: "🇵🇭", name: "Philippines", timezone: "Asia/Manila" },
  { code: "US", flag: "🇺🇸", name: "United States", timezone: "America/New_York" },
  { code: "AE", flag: "🇦🇪", name: "United Arab Emirates", timezone: "Asia/Dubai" },
  { code: "SG", flag: "🇸🇬", name: "Singapore", timezone: "Asia/Singapore" },
  { code: "UK", flag: "🇬🇧", name: "United Kingdom", timezone: "Europe/London" },
  { code: "CA", flag: "🇨🇦", name: "Canada", timezone: "America/Toronto" },
  { code: "AU", flag: "🇦🇺", name: "Australia", timezone: "Australia/Sydney" },
  { code: "JP", flag: "🇯🇵", name: "Japan", timezone: "Asia/Tokyo" },
  { code: "KR", flag: "🇰🇷", name: "South Korea", timezone: "Asia/Seoul" },
  { code: "MY", flag: "🇲🇾", name: "Malaysia", timezone: "Asia/Kuala_Lumpur" },
  { code: "OTHER", flag: "🌍", name: "Other", timezone: null },
];

export const DEFAULT_COUNTRY = "PH";

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Header codes that don't match our selector 1:1 (ISO → product code). */
const CODE_ALIASES: Record<string, string> = { GB: "UK" };

export const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.name])
);
export const COUNTRY_TIMEZONES: Record<string, string | null> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.timezone])
);

/**
 * Coerce any input to a supported selector code. Applies ISO aliases (GB→UK),
 * upper-cases, and falls back to OTHER for anything unlisted — so the value
 * always matches a real `<option>` (never leaves the select unselectable).
 */
export function normalizeCountry(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  const aliased = CODE_ALIASES[raw] ?? raw;
  if (BY_CODE.has(aliased)) return aliased;
  return raw ? "OTHER" : DEFAULT_COUNTRY;
}

/** Display name for a (already-normalized or raw) country code. */
export function countryName(code: string): string {
  return BY_CODE.get(normalizeCountry(code))?.name ?? "Other";
}

/** Primary IANA timezone for a country code (null when unknown/OTHER). */
export function countryTimezone(code: string): string | null {
  return BY_CODE.get(normalizeCountry(code))?.timezone ?? null;
}

// --- Runtime schema self-heal (User country columns) ------------------------
type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

export const COUNTRY_DDL: string[] = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "countryName" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT`,
];

let schemaHealed = false;
export async function ensureCountrySchemaOnce(db: RawRunner): Promise<void> {
  if (schemaHealed) return;
  try {
    for (const sql of COUNTRY_DDL) await db.$executeRawUnsafe(sql);
    schemaHealed = true;
  } catch (e) {
    console.error("[country-schema] self-heal failed:", e);
  }
}
