/**
 * Conversation domain types + DTOs shared between server and client.
 *
 * The tutor returns a natural reply AND a structured coaching block. The two are
 * rendered separately by the client, so they are modelled separately here.
 */

/** The tutor's read of the learner's demonstrated level — drives adaptation. */
export type LearnerLevel = "beginner" | "building" | "conversational" | "fluent";

export const LEARNER_LEVELS: readonly LearnerLevel[] = [
  "beginner",
  "building",
  "conversational",
  "fluent",
];

export interface Scenario {
  id: string;
  /** Short title, e.g. "Calling your lola". */
  title: string;
  /** One line the learner sees. */
  description: string;
  /** Who the tutor role-plays + the situation, fed to the model. */
  persona: string;
}

/** Per-learner state passed in on every turn (the model is stateless). */
export interface LearnerState {
  level: LearnerLevel;
  /** Learner's stronger language; the tutor drops into it only to unblock. */
  baseLanguage: string;
  /** Free-text notes, e.g. resurfaced weak phonemes (Phase 4). */
  weakSpots: string[];
}

/* ── Coaching block (strict JSON the model appends after its reply) ── */

export interface Correction {
  /** What the learner said. */
  original: string;
  /** A more natural way to say it. */
  better: string;
  /** Warm, specific reason — never shaming. */
  note: string;
}

export interface NewPhrase {
  phrase: string;
  meaning: string;
}

export interface Coaching {
  corrections: Correction[];
  /** A targeted pronunciation note, or null if nothing to flag. */
  pronunciation: string | null;
  /** Register / code-switching note (e.g. Taglish, po/opo), or null. */
  register: string | null;
  /** One new phrase to stretch the learner, or null. */
  newPhrase: NewPhrase | null;
  /** The tutor's read of the learner's level this turn. */
  level: LearnerLevel;
  /** A short word of encouragement, or null. */
  encouragement: string | null;
}

/* ── Transcript ── */

export type UtteranceRole = "learner" | "tutor";

export interface Utterance {
  id: string;
  role: UtteranceRole;
  /** The natural-language text (the tutor's reply, coaching stripped out). */
  text: string;
  /** Present only on tutor turns that carried a parseable coaching block. */
  coaching?: Coaching | null;
  createdAt: string;
}

export interface Session {
  id: string;
  scenario: Scenario;
  learnerState: LearnerState;
  utterances: Utterance[];
  createdAt: string;
  updatedAt: string;
}

/* ── API DTOs ── */

export interface CreateSessionRequest {
  /** Optional custom scenario; falls back to a default. */
  scenario?: Partial<Scenario>;
  level?: LearnerLevel;
  baseLanguage?: string;
}

export interface CreateSessionResponse {
  session: Session;
}

export interface SendMessageRequest {
  text: string;
}

export interface SendMessageResponse {
  /** The tutor's natural reply, in the target language. */
  reply: string;
  /** Structured coaching, or null when the model returned none/garbled output. */
  coaching: Coaching | null;
  /** The learner's level after this turn (may have adapted). */
  level: LearnerLevel;
  /** The persisted tutor utterance. */
  utterance: Utterance;
}

export interface GetSessionResponse {
  session: Session;
}

/* ── Prompt authoring ── */

export interface PromptVersionMeta {
  id: string;
  label: string;
  notes: string;
  createdAt: string;
  active: boolean;
}

export interface PromptListResponse {
  active: string;
  versions: PromptVersionMeta[];
}

export interface PromptVersionResponse {
  id: string;
  active: boolean;
  content: string;
}
