/**
 * Provider-adapter interfaces.
 *
 * These are the ONLY contracts the orchestration layer knows about. No vendor
 * SDK (Anthropic, OpenAI/Whisper, ElevenLabs, ...) may be imported outside of a
 * concrete adapter that implements one of these interfaces. Swapping a vendor
 * means writing a new adapter — never touching app logic.
 */

/* ────────────────────────────── LLM ────────────────────────────── */

export type LLMRole = "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMCompletionRequest {
  /** The (versioned) tutor system prompt. */
  system: string;
  /** Full conversation so far — the model is stateless between calls. */
  messages: LLMMessage[];
  /** Optional override; adapters fall back to their configured default model. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMCompletionResult {
  text: string;
  model: string;
  stopReason?: string;
  usage?: LLMUsage;
}

export interface LLMProvider {
  /** Stable identifier, e.g. "claude" or "stub". */
  readonly name: string;
  /** Whether this adapter talks to a real vendor ("live") or returns fakes ("stub"). */
  readonly mode: ProviderMode;
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>;
}

/* ────────────────────────────── STT ────────────────────────────── */

/** Raw audio payload. Bytes only — never a vendor-specific handle. */
export interface AudioInput {
  /** Encoded audio bytes (e.g. m4a/webm/wav contents). */
  bytes: Uint8Array;
  mimeType: string;
  /** BCP-47-ish language hint for the recogniser, e.g. "tl" (Tagalog). */
  languageCode: string;
  sampleRateHz?: number;
}

export interface STTWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface STTResult {
  transcript: string;
  languageCode: string;
  /** 0..1 overall confidence. */
  confidence: number;
  /** Word-level timing, used downstream by pronunciation scoring. */
  words: STTWord[];
  provider: string;
  durationMs: number;
}

export interface STTProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  transcribe(input: AudioInput): Promise<STTResult>;
}

/* ────────────────────────────── TTS ────────────────────────────── */

export type AudioFormat = "mp3" | "wav" | "ogg";

export interface TTSRequest {
  text: string;
  languageCode: string;
  /** Adapter falls back to its configured default voice when omitted. */
  voiceId?: string;
  format?: AudioFormat;
  /** 0.5..2.0; 1.0 is natural pace. */
  speakingRate?: number;
}

export interface TTSResult {
  /** Encoded audio bytes for the client to play. */
  audio: Uint8Array;
  mimeType: string;
  voiceId: string;
  provider: string;
  durationMs: number;
}

export interface TTSProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  synthesize(req: TTSRequest): Promise<TTSResult>;
}

/* ──────────────────────────── shared ───────────────────────────── */

export type ProviderMode = "live" | "stub";

export interface ProviderSet {
  llm: LLMProvider;
  stt: STTProvider;
  tts: TTSProvider;
}
