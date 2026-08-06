import type { PhonemeStat, PronunciationReport } from "@lola/shared";

const WEAK_STATUSES = new Set(["off", "missed", "shaky"]);

/**
 * Folds a turn's pronunciation report into the running per-phoneme stats.
 * Returns a new map (does not mutate the input).
 */
export function updatePhonemeStats(
  existing: Record<string, PhonemeStat> | undefined,
  report: PronunciationReport,
): Record<string, PhonemeStat> {
  const stats: Record<string, PhonemeStat> = { ...(existing ?? {}) };
  const now = new Date().toISOString();

  for (const p of report.phonemes) {
    if (p.status === "extra") continue; // extras aren't a target phoneme
    const prev = stats[p.phoneme] ?? {
      phoneme: p.phoneme,
      attempts: 0,
      errors: 0,
      lastScore: 1,
      lastSeenAt: now,
    };
    stats[p.phoneme] = {
      phoneme: p.phoneme,
      attempts: prev.attempts + 1,
      errors: prev.errors + (WEAK_STATUSES.has(p.status) ? 1 : 0),
      lastScore: p.score,
      lastSeenAt: now,
    };
  }
  return stats;
}

/**
 * Picks the phonemes worth resurfacing: enough attempts to be a pattern, a real
 * error rate, worst first. Returned as short labels for the tutor prompt.
 */
export function deriveWeakSpots(
  stats: Record<string, PhonemeStat> | undefined,
  max = 4,
  minAttempts = 2,
  minErrorRate = 0.34,
): string[] {
  if (!stats) return [];
  return Object.values(stats)
    .filter((s) => s.attempts >= minAttempts && s.errors / s.attempts >= minErrorRate)
    .sort((a, b) => b.errors / b.attempts - a.errors / a.attempts || b.attempts - a.attempts)
    .slice(0, max)
    .map((s) => s.phoneme);
}
