/**
 * Country helpers + schema self-heal for global-expansion signup.
 *
 * Single source of truth for the country selector: residence country, its
 * flag/name, phone dial code + placeholder, and primary IANA timezone. Pure and
 * client-safe (no prisma import). The DDL runs at RUNTIME over the live
 * connection (this repo uses `prisma db push` + self-heal, not migrate dev), so
 * the columns provision even when the build can't reach the DB. Mirrors phone.ts.
 *
 * `code` is ISO 3166-1 alpha-2, except "UK" (United Kingdom) which we keep to
 * match the product's selector; Vercel's geo header sends "GB", so
 * `normalizeCountry` aliases GB → UK. "OTHER" is a catch-all for unlisted
 * countries (name "Other", bare "+" dial code, UTC timezone).
 */

import { runDdlBatch, type RawRunner } from "./schema-ddl";

export interface Country {
  code: string;
  flag: string;
  name: string;
  /** Phone dial code, e.g. "+63". "+" for OTHER. */
  dialCode: string;
  /** Example national number, shown as the phone input placeholder. */
  placeholder: string;
  /** Primary IANA timezone for the country. */
  timezone: string;
}

/** Countries offered in the signup selector (grouped; order preserved in UI). */
export const COUNTRIES: Country[] = [
  // Southeast Asia
  { code: "PH", name: "Philippines", flag: "🇵🇭", dialCode: "+63", placeholder: "917 123 4567", timezone: "Asia/Manila" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", dialCode: "+65", placeholder: "8123 4567", timezone: "Asia/Singapore" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", dialCode: "+60", placeholder: "12-345 6789", timezone: "Asia/Kuala_Lumpur" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", dialCode: "+62", placeholder: "812-3456-7890", timezone: "Asia/Jakarta" },

  // Africa
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234", placeholder: "803 123 4567", timezone: "Africa/Lagos" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", dialCode: "+27", placeholder: "71 123 4567", timezone: "Africa/Johannesburg" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dialCode: "+254", placeholder: "712 123456", timezone: "Africa/Nairobi" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", dialCode: "+233", placeholder: "24 123 4567", timezone: "Africa/Accra" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", dialCode: "+20", placeholder: "100 123 4567", timezone: "Africa/Cairo" },

  // Middle East
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", dialCode: "+971", placeholder: "50 123 4567", timezone: "Asia/Dubai" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", dialCode: "+966", placeholder: "50 123 4567", timezone: "Asia/Riyadh" },

  // Western
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1", placeholder: "(555) 123-4567", timezone: "America/New_York" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1", placeholder: "(555) 123-4567", timezone: "America/Toronto" },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44", placeholder: "7911 123456", timezone: "Europe/London" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "+61", placeholder: "412 345 678", timezone: "Australia/Sydney" },

  // Asia
  { code: "JP", name: "Japan", flag: "🇯🇵", dialCode: "+81", placeholder: "90-1234-5678", timezone: "Asia/Tokyo" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", dialCode: "+82", placeholder: "10-1234-5678", timezone: "Asia/Seoul" },
  { code: "IN", name: "India", flag: "🇮🇳", dialCode: "+91", placeholder: "98765 43210", timezone: "Asia/Kolkata" },

  { code: "OTHER", name: "Other", flag: "🌍", dialCode: "+", placeholder: "Enter number", timezone: "UTC" },
];

export const DEFAULT_COUNTRY = "PH";

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
const OTHER = BY_CODE.get("OTHER")!;

/** Header codes that don't match our selector 1:1 (ISO → product code). */
const CODE_ALIASES: Record<string, string> = { GB: "UK" };

export const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.name])
);
export const COUNTRY_TIMEZONES: Record<string, string> = Object.fromEntries(
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

/** Full country record for a code (normalized; OTHER if unknown). */
export function getCountry(code: string): Country {
  return BY_CODE.get(normalizeCountry(code)) ?? OTHER;
}

/** Display name for a country code. */
export function countryName(code: string): string {
  return getCountry(code).name;
}

/** Emoji flag for a country code. */
export function countryFlag(code: string): string {
  return getCountry(code).flag;
}

/** Phone dial code for a country code, e.g. "+63". */
export function countryDialCode(code: string): string {
  return getCountry(code).dialCode;
}

/** Phone input placeholder for a country code. */
export function countryPlaceholder(code: string): string {
  return getCountry(code).placeholder;
}

/** Primary IANA timezone for a country code (UTC for OTHER/unknown). */
export function countryTimezone(code: string): string {
  return getCountry(code).timezone;
}

// --- Runtime schema self-heal (User country columns) ------------------------
export const COUNTRY_DDL: string[] = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "countryName" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT`,
  // Client mirrors country for admin display + admin-created clients (no User).
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "country" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "countryName" TEXT`,
];

let schemaHealed = false;
export async function ensureCountrySchemaOnce(db: RawRunner): Promise<void> {
  if (schemaHealed) return;
  const { failures } = await runDdlBatch(db, COUNTRY_DDL);
  if (failures.length === 0) schemaHealed = true;
  else console.error("[country-schema] self-heal incomplete:", failures);
}
