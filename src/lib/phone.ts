/**
 * Phone-number helpers + schema self-heal. The constants/validators are pure
 * and client-safe (no prisma import). The DDL runs at RUNTIME over the live
 * connection (this repo uses `prisma db push` + self-heal, not migrate dev), so
 * the columns provision even when the build can't reach the DB.
 */

export interface CountryCode {
  code: string;
  flag: string;
  label: string;
}

/** Supported dialing codes for the signup selector. */
export const COUNTRY_CODES: CountryCode[] = [
  { code: "+63", flag: "🇵🇭", label: "🇵🇭 +63" },
  { code: "+1", flag: "🇺🇸", label: "🇺🇸 +1" },
  { code: "+44", flag: "🇬🇧", label: "🇬🇧 +44" },
  { code: "+65", flag: "🇸🇬", label: "🇸🇬 +65" },
  { code: "+971", flag: "🇦🇪", label: "🇦🇪 +971" },
];

export const DEFAULT_COUNTRY_CODE = "+63";

const VALID_CODES = new Set(COUNTRY_CODES.map((c) => c.code));

/** Coerce to a supported dialing code, defaulting to +63 (PH). */
export function normalizeCountryCode(value: unknown): string {
  const s = String(value ?? "").trim();
  return VALID_CODES.has(s) ? s : DEFAULT_COUNTRY_CODE;
}

/** Strip everything but digits from a phone number. */
export function normalizePhoneNumber(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** A local number is 10–11 digits (no country code). */
export function isValidPhoneNumber(value: unknown): boolean {
  return /^[0-9]{10,11}$/.test(normalizePhoneNumber(value));
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
