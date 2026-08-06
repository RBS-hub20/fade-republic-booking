import type { AudioInput, STTProvider, STTResult, STTWord } from "@lola/shared";

/**
 * Live STT adapter for OpenAI Whisper. The only place the Whisper API is called.
 *
 * Requests verbose JSON with word-level timestamps so Phase 4 pronunciation
 * scoring has real alignment data to work with.
 */
export class WhisperSTTProvider implements STTProvider {
  readonly name = "whisper";
  readonly mode = "live" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model = "whisper-1",
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async transcribe(input: AudioInput): Promise<STTResult> {
    const form = new FormData();
    const blob = new Blob([toArrayBuffer(input.bytes)], { type: input.mimeType });
    form.append("file", blob, filenameFor(input.mimeType));
    form.append("model", this.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    if (input.languageCode) form.append("language", input.languageCode);

    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`[lola] Whisper transcription failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as WhisperVerboseResponse;
    const words: STTWord[] = (data.words ?? []).map((w) => ({
      word: w.word,
      startMs: Math.round((w.start ?? 0) * 1000),
      endMs: Math.round((w.end ?? 0) * 1000),
      confidence: 1,
    }));

    return {
      transcript: (data.text ?? "").trim(),
      languageCode: data.language || input.languageCode,
      confidence: confidenceFromSegments(data.segments),
      words,
      provider: "whisper",
      durationMs: Math.round((data.duration ?? 0) * 1000),
    };
  }
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}
interface WhisperSegment {
  avg_logprob?: number;
}
interface WhisperVerboseResponse {
  text?: string;
  language?: string;
  duration?: number;
  words?: WhisperWord[];
  segments?: WhisperSegment[];
}

/** Whisper gives no per-word probability; approximate overall confidence from
 * segment avg log-probabilities (already in nats). */
function confidenceFromSegments(segments?: WhisperSegment[]): number {
  if (!segments || segments.length === 0) return 1;
  const logprobs = segments
    .map((s) => s.avg_logprob)
    .filter((p): p is number => typeof p === "number");
  if (logprobs.length === 0) return 1;
  const avg = logprobs.reduce((a, b) => a + b, 0) / logprobs.length;
  return Math.min(1, Math.max(0, Math.exp(avg)));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function filenameFor(mimeType: string): string {
  const ext = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : mimeType.includes("wav")
        ? "wav"
        : mimeType.includes("mpeg") || mimeType.includes("mp3")
          ? "mp3"
          : "audio";
  return `learner.${ext}`;
}
