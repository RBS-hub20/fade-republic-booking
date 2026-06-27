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
