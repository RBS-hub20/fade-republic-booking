import type { ProviderSet } from "@lola/shared";
import type { AppConfig } from "../config/env.js";
import { StubLLMProvider } from "./llm/stub.js";
import { ClaudeLLMProvider } from "./llm/claude.js";
import { StubSTTProvider } from "./stt/stub.js";
import { WhisperSTTProvider } from "./stt/whisper.js";
import { StubTTSProvider } from "./tts/stub.js";
import { ElevenLabsTTSProvider } from "./tts/elevenlabs.js";

/**
 * Builds the active provider set from config.
 *
 * Live adapters (Claude, Whisper, ElevenLabs) are used when LOLA_LIVE_PROVIDERS=1
 * and the matching key is present; otherwise each provider falls back to its
 * stub so the loop always runs. Health reports each provider's REAL mode (read
 * from the adapter instance), so the active backend is always visible.
 */
export function createProviders(config: AppConfig): ProviderSet {
  return {
    llm: buildLLM(config),
    stt: buildSTT(config),
    tts: buildTTS(config),
  };
}

function buildLLM(config: AppConfig): ProviderSet["llm"] {
  const llm = config.providers.llm;
  if (llm.mode === "live" && llm.apiKey) {
    return new ClaudeLLMProvider(llm.apiKey, llm.model);
  }
  return new StubLLMProvider();
}

function buildSTT(config: AppConfig): ProviderSet["stt"] {
  const stt = config.providers.stt;
  if (stt.mode === "live" && stt.apiKey) {
    return new WhisperSTTProvider(stt.apiKey);
  }
  return new StubSTTProvider();
}

function buildTTS(config: AppConfig): ProviderSet["tts"] {
  const tts = config.providers.tts;
  if (tts.mode === "live" && tts.apiKey) {
    return new ElevenLabsTTSProvider(tts.apiKey, tts.defaultVoiceId);
  }
  return new StubTTSProvider();
}
