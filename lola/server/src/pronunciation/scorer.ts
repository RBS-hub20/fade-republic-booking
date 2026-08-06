import type { PhonemeScore, PhonemeStatus, PronunciationReport } from "@lola/shared";
import { phonemize, VOWELS } from "./g2p.js";
import { alignPhonemes } from "./align.js";

export interface ScoreInput {
  /** The native form the learner was aiming for. */
  target: string;
  /** What STT heard. */
  heard: string;
  /** Overall STT confidence (0..1); low confidence softens "good" → "shaky". */
  confidence?: number;
}

/** Readable labels for phoneme tokens shown to the learner. */
const LABEL: Record<string, string> = { "ŋ": "ng", ny: "ñ" };

export function labelFor(token: string): string {
  return LABEL[token] ?? token;
}

/** Targeted, warm advice per phoneme. */
const TIP: Record<string, string> = {
  "ŋ": "Let the *ng* hum from the back of your mouth — there's no hard g at the end.",
  r: "Tap the *r* once with the tip of your tongue — lighter and quicker than the English r.",
  a: "Keep the *a* open and pure, like 'ah' — not 'uh'.",
  e: "Keep the *e* short and clean, closer to 'eh'.",
  i: "A bright, short *i* — like 'ee', not 'ih'.",
  o: "Round the *o* fully — not an English 'aw'.",
  u: "A pure *u* — like 'oo', kept short.",
  h: "Give the *h* a soft, breathy push so it doesn't disappear.",
  ny: "Blend the *ñ* like the 'ny' in 'canyon'.",
  p: "Soften the *p* — Tagalog stops have no puff of air.",
  t: "Soften the *t* — touch it lightly, no English aspiration.",
  k: "Soften the *k* — no puff of air after it.",
};

const CONF_THRESHOLD = 0.7;
const SUB_SCORE = 0.2;
const SHAKY_SCORE = 0.7;

/**
 * Scores a spoken utterance against its target by aligning phoneme sequences and
 * grading each target phoneme. Produces specific, per-phoneme feedback — never a
 * bare number.
 */
export class PronunciationScorer {
  score(input: ScoreInput): PronunciationReport {
    const targetPhonemes = phonemize(input.target);
    const heardPhonemes = phonemize(input.heard);
    const lowConfidence = (input.confidence ?? 1) < CONF_THRESHOLD;

    if (targetPhonemes.length === 0) {
      return { overall: 1, target: input.target, heard: input.heard, phonemes: [], weakPhonemes: [], tips: [] };
    }

    const ops = alignPhonemes(targetPhonemes, heardPhonemes);
    const phonemes: PhonemeScore[] = [];
    let scoreSum = 0;
    let scoreCount = 0;
    let extras = 0;

    for (const op of ops) {
      if (op.type === "match") {
        const shaky = lowConfidence;
        phonemes.push({
          phoneme: labelFor(op.target),
          produced: labelFor(op.heard),
          status: shaky ? "shaky" : "good",
          score: shaky ? SHAKY_SCORE : 1,
          note: shaky ? "We heard it, but it came through faintly — say it a touch more clearly." : null,
        });
        scoreSum += shaky ? SHAKY_SCORE : 1;
        scoreCount++;
      } else if (op.type === "sub") {
        phonemes.push({
          phoneme: labelFor(op.target),
          produced: labelFor(op.heard),
          status: "off",
          score: SUB_SCORE,
          note: substitutionNote(op.target, op.heard),
        });
        scoreSum += SUB_SCORE;
        scoreCount++;
      } else if (op.type === "del") {
        phonemes.push({
          phoneme: labelFor(op.target),
          produced: null,
          status: "missed",
          score: 0,
          note: `The *${labelFor(op.target)}* got dropped. ${TIP[op.target] ?? "Give it a clear, gentle press."}`,
        });
        scoreSum += 0;
        scoreCount++;
      } else {
        extras++;
        phonemes.push({
          phoneme: labelFor(op.heard),
          produced: labelFor(op.heard),
          status: "extra",
          score: 0.4,
          note: `An extra *${labelFor(op.heard)}* slipped in — let the word breathe a little less.`,
        });
      }
    }

    const base = scoreCount > 0 ? scoreSum / scoreCount : 1;
    const overall = Math.max(0, base - Math.min(0.2, extras * 0.05));

    const weakStatuses: PhonemeStatus[] = ["off", "missed", "shaky"];
    const weakPhonemes = dedupe(
      phonemes.filter((p) => weakStatuses.includes(p.status)).map((p) => p.phoneme),
    );
    const tips = dedupe(
      phonemes
        .filter((p) => weakStatuses.includes(p.status) && p.note)
        .map((p) => p.note as string),
    ).slice(0, 3);

    return { overall, target: input.target, heard: input.heard, phonemes, weakPhonemes, tips };
  }
}

function substitutionNote(target: string, heard: string): string {
  const base = TIP[target];
  const drift =
    VOWELS.has(target) && VOWELS.has(heard)
      ? `Your *${labelFor(target)}* drifted toward *${labelFor(heard)}* — keep the vowel pure.`
      : `It came out closer to *${labelFor(heard)}* — aim for *${labelFor(target)}*.`;
  return base ? `${drift} ${base}` : drift;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
