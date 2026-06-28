/**
 * Pronunciation scoring types.
 *
 * We align the phonemes of what the learner was reaching for (the "target") with
 * the phonemes of what we actually heard, then score each target phoneme. Over
 * time we track which phonemes are consistently weak and resurface them.
 */

export type PhonemeStatus =
  | "good" // matched cleanly
  | "shaky" // matched, but low confidence
  | "off" // produced a different sound
  | "missed" // dropped the sound
  | "extra"; // inserted a sound that isn't in the target

export interface PhonemeScore {
  /** The target phoneme (e.g. "ng", "r", "a"). */
  phoneme: string;
  /** What we heard in its place, or null when dropped. */
  produced: string | null;
  status: PhonemeStatus;
  /** 0..1. */
  score: number;
  /** Specific, warm advice — present only when there's something to coach. */
  note?: string | null;
}

export interface PronunciationReport {
  /** 0..1 overall accuracy across target phonemes. */
  overall: number;
  /** The native form the learner was aiming for. */
  target: string;
  /** What we heard. */
  heard: string;
  phonemes: PhonemeScore[];
  /** Distinct phonemes that came out weak this turn. */
  weakPhonemes: string[];
  /** Top human-readable tips (deduped), most useful first. */
  tips: string[];
}

/** Running per-phoneme accuracy for one learner. */
export interface PhonemeStat {
  phoneme: string;
  attempts: number;
  errors: number;
  /** Most recent per-phoneme score (0..1). */
  lastScore: number;
  lastSeenAt: string;
}
