/**
 * Auto-assigned, permanent avatars (no upload, no change). 10 pre-made SVGs in
 * /public/avatars. Assignment is deterministic from the user's id + gender.
 *
 * The spec's `id % 5` assumes integer ids; QuantumX uses cuids, so we hash the
 * id to a stable 1–5 bucket instead.
 */
export type Gender = "male" | "female";
export const GENDERS: Gender[] = ["male", "female"];

export function normalizeGender(input: unknown): Gender {
  return String(input).toLowerCase() === "female" ? "female" : "male";
}

/** Stable 1..5 bucket from a cuid (deterministic, no collisions concern). */
function bucket5(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 5) + 1;
}

/** avatar_type = `${gender}-${1..5}` — assigned at signup, permanent. */
export function avatarTypeFor(gender: Gender, id: string): string {
  return `${gender}-${bucket5(id)}`;
}

/** Public URL for an avatar_type; falls back to male-1 when null/invalid. */
export function avatarSrc(avatarType: string | null | undefined): string {
  const t = avatarType && /^(male|female)-[1-5]$/.test(avatarType) ? avatarType : "male-1";
  return `/avatars/${t}.svg`;
}

// ---- runtime self-heal DDL (matches the referral/genealogy pattern) --------
type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

export const AVATAR_DDL: string[] = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" TEXT NOT NULL DEFAULT 'male'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarType" TEXT`,
  // Speeds up direct-downline (sponsor) lookups for the tree.
  `CREATE INDEX IF NOT EXISTS "User_referredById_idx" ON "User"("referredById")`,
];

let schemaHealed = false;
export async function ensureAvatarSchemaOnce(db: RawRunner): Promise<void> {
  if (schemaHealed) return;
  let allOk = true;
  for (const sql of AVATAR_DDL) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e) {
      allOk = false;
      console.error("[avatar-schema] statement failed:", e);
    }
  }
  if (allOk) schemaHealed = true;
}
