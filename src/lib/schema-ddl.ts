/**
 * Shared runner for the additive self-heal DDL guards (ensure*SchemaOnce).
 *
 * Instead of one `$executeRawUnsafe` round trip PER statement, we send the whole
 * batch as a SINGLE PL/pgSQL `DO` block — cutting cold-start latency (each guard
 * was N round trips; now it's 1). All statements are idempotent
 * (IF [NOT] EXISTS), so re-running is a no-op.
 *
 * Safety: the block is atomic — on any error it rolls back, and we fall back to
 * applying each statement independently, collecting per-statement failures. The
 * caller latches its "healed" flag only when `failures` is empty, so a degraded
 * DB never marks the schema complete while a column/table is still missing
 * (that mismatch is exactly what causes P2022 crashes). Net effect: healthy DB =
 * 1 round trip; degraded DB = same best-effort application as before, minus the
 * latch.
 */
export type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

export interface DdlResult {
  applied: number;
  failures: { sql: string; error: string }[];
}

function firstLine(sql: string): string {
  return sql.split("\n")[0].trim();
}

export async function runDdlBatch(
  db: RawRunner,
  statements: readonly string[]
): Promise<DdlResult> {
  const stmts = statements.map((s) => s.trim().replace(/;\s*$/, "")).filter(Boolean);
  if (stmts.length === 0) return { applied: 0, failures: [] };

  // Fast path: one round trip. `$ddl$` dollar-quoting can't collide with the
  // DDL (verified none contains it).
  try {
    await db.$executeRawUnsafe(`DO $ddl$ BEGIN\n${stmts.join(";\n")};\nEND $ddl$;`);
    return { applied: stmts.length, failures: [] };
  } catch {
    // Fallback: apply each statement on its own so partial progress still
    // lands, and report what failed.
    let applied = 0;
    const failures: { sql: string; error: string }[] = [];
    for (const sql of stmts) {
      try {
        await db.$executeRawUnsafe(sql);
        applied += 1;
      } catch (e: any) {
        failures.push({ sql: firstLine(sql), error: e?.message?.split("\n")[0] ?? "failed" });
      }
    }
    return { applied, failures };
  }
}
