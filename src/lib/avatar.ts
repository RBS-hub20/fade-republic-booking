/**
 * Auto-assigned, permanent avatars (no upload, no change). 10 pre-made SVGs in
 * /public/avatars. Assignment is deterministic from the user's id alone.
 *
 * The `${gender}-N` filenames are retained as opaque asset identifiers — the
 * avatar is no longer tied to gender (that field has been removed); each user
 * gets a stable pick across all 10 by hashing their cuid. Existing avatarType
 * values keep rendering unchanged.
 */

/** The 10 avatar asset ids (filenames in /public/avatars, sans extension). */
export const AVATARS: string[] = [
  "male-1", "male-2", "male-3", "male-4", "male-5",
  "female-1", "female-2", "female-3", "female-4", "female-5",
];

/** Stable 0..(n-1) bucket from a cuid (deterministic, no collisions concern). */
function bucket(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % n;
}

/** avatar_type = one of the 10 assets — assigned at signup, permanent. */
export function avatarTypeFor(id: string): string {
  return AVATARS[bucket(id, AVATARS.length)];
}

/** Public URL for an avatar_type; falls back to male-1 when null/invalid. */
export function avatarSrc(avatarType: string | null | undefined): string {
  const t = avatarType && /^(male|female)-[1-5]$/.test(avatarType) ? avatarType : "male-1";
  return `/avatars/${t}.svg`;
}

// ---- runtime self-heal DDL (matches the referral/genealogy pattern) --------
type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

export const AVATAR_DDL: string[] = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarType" TEXT`,
  // Speeds up direct-downline (sponsor) lookups for the tree.
  `CREATE INDEX IF NOT EXISTS "User_referredById_idx" ON "User"("referredById")`,
  // Gender has been removed from the product — retire the column completely
  // (idempotent; a no-op on fresh DBs that never had it).
  `ALTER TABLE "User" DROP COLUMN IF EXISTS "gender"`,
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
