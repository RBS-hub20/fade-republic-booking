import { prisma } from "./prisma";

/** Admin-toggleable feature flags. */
export const FLAG_BONUS_MODAL = "celebration.bonusModal";
export const FLAG_SHANGHAI_MODAL = "celebration.shanghaiModal";

/**
 * Read boolean flags. FAIL-OPEN: a missing Setting table/row → the default
 * (ON), so a not-yet-migrated DB never hides features. A flag is off only when
 * explicitly stored as "false".
 */
export async function getBoolFlags(keys: string[], dflt = true): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = dflt;
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
    for (const r of rows) out[r.key] = r.value !== "false";
  } catch {
    /* table missing → keep defaults (ON) */
  }
  return out;
}

export async function getBoolFlag(key: string, dflt = true): Promise<boolean> {
  return (await getBoolFlags([key], dflt))[key];
}

export async function setBoolFlag(key: string, value: boolean): Promise<void> {
  const v = value ? "true" : "false";
  await prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
}
