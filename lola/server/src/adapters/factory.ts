import type { ProviderSet } from "@lola/shared";
import type { AppConfig } from "../config/env.js";
import { StubLLMProvider } from "./llm/stub.js";
import { ClaudeLLMProvider } from "./llm/claude.js";
import { StubSTTProvider } from "./stt/stub.js";
import { StubTTSProvider } from "./tts/stub.js";

/**
 * Builds the active provider set from config.
 *
 * Phase 1 ships stub adapters only. When config asks for a "live" provider that
 * has no adapter yet, we downgrade to the stub and warn — the loop keeps
 * working instead of crashing. Health always reports each provider's REAL mode
 * (read from the adapter), so a downgrade is visible, never hidden.
 *
 * Phase 2+ adds live branches here; nothing else in the app changes.
 */
export function createProviders(config: AppConfig): ProviderSet {
  return {
    llm: buildLLM(config),
    stt: buildSTT(config),
    tts: buildTTS(config),
  };
}

function notYet(kind: string, vendor: string): void {
  console.warn(
    `[lola] Live ${kind} adapter "${vendor}" is not available yet; using stub. ` +
      `It will be wired in a later phase.`,
  );
}

function buildLLM(config: AppConfig): ProviderSet["llm"] {
  const llm = config.providers.llm;
  if (llm.mode === "live" && llm.apiKey) {
    return new ClaudeLLMProvider(llm.apiKey, llm.model);
  }
  return new StubLLMProvider();
}

function buildSTT(config: AppConfig): ProviderSet["stt"] {
  if (config.providers.stt.mode === "live") notYet("STT", config.providers.stt.vendor);
  return new StubSTTProvider();
}

function buildTTS(config: AppConfig): ProviderSet["tts"] {
  if (config.providers.tts.mode === "live") notYet("TTS", config.providers.tts.vendor);
  return new StubTTSProvider();
}
