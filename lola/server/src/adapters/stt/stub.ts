import type { AudioInput, STTProvider, STTResult, STTWord } from "@lola/shared";

/**
 * Stub STT adapter. Produces a plausible Tagalog transcript with word-level
 * timings so pronunciation scoring (Phase 4) can be built against real shapes.
 */
export class StubSTTProvider implements STTProvider {
  readonly name = "stub";
  readonly mode = "stub" as const;

  async transcribe(input: AudioInput): Promise<STTResult> {
    const transcript = "Kumusta po kayo, Lola?";
    const tokens = transcript.split(/\s+/);

    let cursor = 0;
    const perWordMs = 380;
    const words: STTWord[] = tokens.map((word) => {
      const startMs = cursor;
      cursor += perWordMs;
      return {
        word,
        startMs,
        endMs: cursor,
        confidence: 0.92,
      };
    });

    return {
      transcript,
      languageCode: input.languageCode || "tl",
      confidence: 0.92,
      words,
      provider: "stub",
      durationMs: cursor,
    };
  }
}
