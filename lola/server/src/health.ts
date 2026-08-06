import type { HealthResponse, ProviderHealth, ProviderSet } from "@lola/shared";
import type { AppConfig } from "./config/env.js";

/**
 * Builds the health payload. Provider mode is read from the live adapter
 * instances (not config), so a silent downgrade to a stub is always visible.
 */
export function buildHealth(config: AppConfig, providers: ProviderSet): HealthResponse {
  const providerHealth: ProviderHealth[] = [
    { kind: "llm", name: providers.llm.name, mode: providers.llm.mode, ok: true },
    { kind: "stt", name: providers.stt.name, mode: providers.stt.mode, ok: true },
    { kind: "tts", name: providers.tts.name, mode: providers.tts.mode, ok: true },
  ];

  const allOk = providerHealth.every((p) => p.ok);

  return {
    status: allOk ? "ok" : "degraded",
    service: config.service,
    version: config.version,
    time: new Date().toISOString(),
    providers: providerHealth,
    language: config.language,
  };
}
