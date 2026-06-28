/**
 * Client-facing API response shapes.
 *
 * Mirrors the server's `@lola/shared` DTOs. Kept as a small standalone copy so
 * the Expo app (Metro bundler) has no cross-package build dependency in Phase 1.
 * If these drift, the server is the source of truth.
 */

export type ProviderMode = "live" | "stub";

export interface ProviderHealth {
  kind: "llm" | "stt" | "tts";
  name: string;
  mode: ProviderMode;
  ok: boolean;
}

export interface LanguageProfile {
  target: string;
  targetLabel: string;
  base: string;
  baseLabel: string;
  registers: string[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  time: string;
  providers: ProviderHealth[];
  language: LanguageProfile;
}

/* ── Conversation ── */

export type LearnerLevel = "beginner" | "building" | "conversational" | "fluent";

export interface Scenario {
  id: string;
  title: string;
  description: string;
  persona: string;
}

export interface Correction {
  original: string;
  better: string;
  note: string;
}

export interface NewPhrase {
  phrase: string;
  meaning: string;
}

export interface Coaching {
  corrections: Correction[];
  pronunciation: string | null;
  register: string | null;
  newPhrase: NewPhrase | null;
  level: LearnerLevel;
  encouragement: string | null;
}

export interface Utterance {
  id: string;
  role: "learner" | "tutor";
  text: string;
  coaching?: Coaching | null;
  createdAt: string;
}

export interface Session {
  id: string;
  scenario: Scenario;
  learnerState: { level: LearnerLevel; baseLanguage: string; weakSpots: string[] };
  utterances: Utterance[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  reply: string;
  coaching: Coaching | null;
  level: LearnerLevel;
  utterance: Utterance;
}

export interface VoiceTurnResponse {
  transcript: string;
  transcriptConfidence: number;
  reply: string;
  coaching: Coaching | null;
  level: LearnerLevel;
  utterance: Utterance;
  audioBase64: string;
  audioMimeType: string;
}
