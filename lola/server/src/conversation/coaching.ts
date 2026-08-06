import type { Coaching, Correction, LearnerLevel, NewPhrase } from "@lola/shared";
import { LEARNER_LEVELS } from "@lola/shared";

/**
 * The model is asked to end its message with this sentinel on its own line,
 * followed by a single line of strict, minified JSON coaching. Splitting on a
 * sentinel is far more robust than "the last line is JSON".
 */
export const COACHING_SENTINEL = "<<<COACHING>>>";

export interface ParsedTurn {
  /** The natural reply with the coaching block removed. */
  reply: string;
  /** Validated coaching, or null when absent/malformed. */
  coaching: Coaching | null;
}

/**
 * Splits a raw model message into the conversational reply and (if present and
 * valid) the structured coaching block.
 *
 * Hard guarantee: this never throws. Any malformed, partial, or missing coaching
 * degrades to `{ reply, coaching: null }` so the conversation keeps flowing.
 */
export function parseTutorMessage(raw: string): ParsedTurn {
  const text = (raw ?? "").trim();
  const idx = text.lastIndexOf(COACHING_SENTINEL);

  if (idx === -1) {
    return { reply: text, coaching: null };
  }

  const reply = text.slice(0, idx).trim();
  const jsonPart = text.slice(idx + COACHING_SENTINEL.length).trim();

  const coaching = safeParseCoaching(jsonPart);
  // If the JSON was unusable, still strip the sentinel tail from the reply so the
  // learner never sees raw markup.
  return { reply: reply.length > 0 ? reply : text.slice(0, idx).trim(), coaching };
}

function safeParseCoaching(jsonPart: string): Coaching | null {
  if (!jsonPart) return null;

  let data: unknown;
  try {
    data = JSON.parse(jsonPart);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  const obj = data as Record<string, unknown>;
  return {
    corrections: coerceCorrections(obj.corrections),
    pronunciation: coerceNullableString(obj.pronunciation),
    register: coerceNullableString(obj.register),
    newPhrase: coerceNewPhrase(obj.newPhrase),
    level: coerceLevel(obj.level),
    encouragement: coerceNullableString(obj.encouragement),
  };
}

function coerceCorrections(value: unknown): Correction[] {
  if (!Array.isArray(value)) return [];
  const out: Correction[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    const original = asString(c.original);
    const better = asString(c.better);
    const note = asString(c.note);
    if (original || better || note) {
      out.push({ original, better, note });
    }
  }
  return out;
}

function coerceNewPhrase(value: unknown): NewPhrase | null {
  if (typeof value !== "object" || value === null) return null;
  const p = value as Record<string, unknown>;
  const phrase = asString(p.phrase);
  const meaning = asString(p.meaning);
  if (!phrase) return null;
  return { phrase, meaning };
}

function coerceLevel(value: unknown): LearnerLevel {
  if (typeof value === "string" && (LEARNER_LEVELS as readonly string[]).includes(value)) {
    return value as LearnerLevel;
  }
  return "building";
}

function coerceNullableString(value: unknown): string | null {
  const s = asString(value);
  return s.length > 0 ? s : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
