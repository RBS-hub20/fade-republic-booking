/**
 * Phone-number helpers + schema self-heal. The constants/validators are pure
 * and client-safe (no prisma import). The DDL runs at RUNTIME over the live
 * connection (this repo uses `prisma db push` + self-heal, not migrate dev), so
 * the columns provision even when the build can't reach the DB.
 */

import { COUNTRIES } from "./countries";

export interface CountryCode {
  code: string;
  flag: string;
  label: string;
}

/**
 * Dialing codes for the phone selector, derived from the unified country list
 * (src/lib/countries.ts) so signup + admin stay in sync. Deduped by dial code
 * (US/CA share +1) and excluding OTHER's bare "+".
 */
export const COUNTRY_CODES: CountryCode[] = (() => {
  const seen = new Set<string>();
  const out: CountryCode[] = [];
  for (const c of COUNTRIES) {
    if (c.dialCode === "+" || seen.has(c.dialCode)) continue;
    seen.add(c.dialCode);
    out.push({ code: c.dialCode, flag: c.flag, label: `${c.flag} ${c.dialCode}` });
  }
  return out;
})();

export const DEFAULT_COUNTRY_CODE = "+63";

// Accept every dial code in the country list, plus OTHER's "+" so an "Other"
// signup round-trips instead of silently reverting to +63.
const VALID_CODES = new Set<string>([...COUNTRIES.map((c) => c.dialCode), DEFAULT_COUNTRY_CODE]);

/** Coerce to a supported dialing code, defaulting to +63 (PH). */
export function normalizeCountryCode(value: unknown): string {
  const s = String(value ?? "").trim();
  return VALID_CODES.has(s) ? s : DEFAULT_COUNTRY_CODE;
}

/** Strip everything but digits from a phone number. */
export function normalizePhoneNumber(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * A valid national number is 6–15 digits (no country code) — wide enough for
 * every supported country (e.g. Singapore 8-digit, US 10-digit, PH 10–11).
 * 15 is the E.164 maximum for the full international number.
 */
export function isValidPhoneNumber(value: unknown): boolean {
  return /^[0-9]{6,15}$/.test(normalizePhoneNumber(value));
}

/** Full display number, e.g. "+63 9171234567". */
export function formatFullPhone(countryCode: string, phoneNumber: string): string {
  const code = normalizeCountryCode(countryCode);
  const num = normalizePhoneNumber(phoneNumber);
  return num ? `${code} ${num}` : "";
}

/** Grouped, readable number, e.g. "+63 917 123 4567". */
export function formatPhoneDisplay(countryCode: string, phoneNumber: string): string {
  const code = normalizeCountryCode(countryCode);
  const num = normalizePhoneNumber(phoneNumber);
  if (!num) return "";
  const grouped = num.replace(/(\d{3})(\d{3})(\d+)/, "$1 $2 $3");
  return `${code} ${grouped}`;
}

/** E.164-ish tel: href, e.g. "tel:+639171234567". */
export function telHref(countryCode: string, phoneNumber: string): string {
  return `tel:${normalizeCountryCode(countryCode)}${normalizePhoneNumber(phoneNumber)}`;
}

// --- Runtime schema self-heal (User phone columns) --------------------------
type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

export const PHONE_DDL: string[] = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT '+63'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false`,
];

let schemaHealed = false;
export async function ensurePhoneSchemaOnce(db: RawRunner): Promise<void> {
  if (schemaHealed) return;
  try {
    for (const sql of PHONE_DDL) await db.$executeRawUnsafe(sql);
    schemaHealed = true;
  } catch (e) {
    console.error("[phone-schema] self-heal failed:", e);
  }
}
