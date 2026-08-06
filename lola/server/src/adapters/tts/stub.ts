import type { TTSProvider, TTSRequest, TTSResult } from "@lola/shared";

/**
 * Stub TTS adapter. Returns a tiny, valid silent-ish audio payload so the
 * client's play path can be wired before the real ElevenLabs adapter (Phase 3).
 */
export class StubTTSProvider implements TTSProvider {
  readonly name = "stub";
  readonly mode = "stub" as const;

  async synthesize(req: TTSRequest): Promise<TTSResult> {
    // ~1 byte of fake audio per character, capped — purely a placeholder.
    const size = Math.min(Math.max(req.text.length, 1), 256);
    const audio = new Uint8Array(size).fill(0);

    const format = req.format ?? "mp3";
    const mimeType =
      format === "wav" ? "audio/wav" : format === "ogg" ? "audio/ogg" : "audio/mpeg";

    return {
      audio,
      mimeType,
      voiceId: req.voiceId ?? "stub-lola-voice",
      provider: "stub",
      durationMs: Math.round((req.text.length / 14) * 1000),
    };
  }
}
