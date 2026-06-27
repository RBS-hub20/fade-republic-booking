/**
 * Central config + secrets handling.
 *
 * Rules:
 *  - Secrets are read from the environment ONLY, here, server-side.
 *  - The client never receives an API key; it talks to our API, which proxies.
 *  - Each provider runs in "stub" mode until a real key is present AND a live
 *    adapter exists for that phase. Phase 1 ships stubs only.
 */

import type { LanguageProfile, ProviderMode } from "@lola/shared";

export type LLMVendor = "claude" | "stub";
export type STTVendor = "whisper" | "stub";
export type TTSVendor = "elevenlabs" | "stub";

export interface ProviderConfig {
  llm: { vendor: LLMVendor; mode: ProviderMode; model: string; apiKey?: string };
  stt: { vendor: STTVendor; mode: ProviderMode; apiKey?: string };
  tts: {
    vendor: TTSVendor;
    mode: ProviderMode;
    apiKey?: string;
    defaultVoiceId?: string;
  };
}

export interface AppConfig {
  service: string;
  version: string;
  port: number;
  nodeEnv: string;
  /**
   * Phase 1 is stub-only. Flip to false (or set LOLA_LIVE_PROVIDERS=1) once the
   * live adapters land in Phase 2+. Until then we never attempt real calls.
   */
  stubOnly: boolean;
  providers: ProviderConfig;
  language: LanguageProfile;
}

const VERSION = "0.1.0";

/** Target language profile for the MVP: Tagalog + conversational Taglish. */
const LANGUAGE: LanguageProfile = {
  target: "tl",
  targetLabel: "Tagalog",
  base: "en",
  baseLabel: "English",
  registers: ["conversational", "taglish", "formal-po"],
};

function readKey(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function readBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

/**
 * Decide a provider's mode. A vendor goes "live" only when ALL hold:
 *   - we are not globally in stub-only mode,
 *   - a real API key is configured,
 *   - a live adapter exists for it (gated per phase by the factory).
 */
function resolveMode(stubOnly: boolean, apiKey: string | undefined): ProviderMode {
  return !stubOnly && apiKey ? "live" : "stub";
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const stubOnly = !readBool("LOLA_LIVE_PROVIDERS", false);

  const anthropicKey = readKey("ANTHROPIC_API_KEY");
  const openaiKey = readKey("OPENAI_API_KEY");
  const elevenKey = readKey("ELEVENLABS_API_KEY");

  return {
    service: "lola-server",
    version: VERSION,
    port: Number(process.env.PORT ?? 4000),
    nodeEnv,
    stubOnly,
    providers: {
      llm: {
        vendor: "claude",
        mode: resolveMode(stubOnly, anthropicKey),
        model: process.env.LOLA_LLM_MODEL ?? "claude-sonnet-4-6",
        apiKey: anthropicKey,
      },
      stt: {
        vendor: "whisper",
        mode: resolveMode(stubOnly, openaiKey),
        apiKey: openaiKey,
      },
      tts: {
        vendor: "elevenlabs",
        mode: resolveMode(stubOnly, elevenKey),
        apiKey: elevenKey,
        defaultVoiceId: process.env.LOLA_TTS_VOICE_ID,
      },
    },
    language: LANGUAGE,
  };
}
