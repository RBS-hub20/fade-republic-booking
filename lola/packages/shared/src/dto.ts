/**
 * Data-transfer objects shared between the server and the client.
 * Keep these free of any server-only or vendor-only details.
 */

import type { ProviderMode } from "./adapters/types.js";

export interface ProviderHealth {
  kind: "llm" | "stt" | "tts";
  /** Adapter name, e.g. "claude", "whisper", "elevenlabs", "stub". */
  name: string;
  mode: ProviderMode;
  ok: boolean;
}

export interface LanguageProfile {
  /** Target language the learner is reclaiming, e.g. "tl". */
  target: string;
  targetLabel: string;
  /** Learner's stronger/base language, used only to unblock. */
  base: string;
  baseLabel: string;
  /** Spoken registers we coach, e.g. ["conversational", "taglish", "formal-po"]. */
  registers: string[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  /** ISO timestamp. */
  time: string;
  providers: ProviderHealth[];
  language: LanguageProfile;
}
