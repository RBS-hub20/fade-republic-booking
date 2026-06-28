import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  AudioInput,
  LanguageProfile,
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMProvider,
  STTProvider,
  STTResult,
  Session,
  TTSProvider,
  TTSRequest,
  TTSResult,
} from "@lola/shared";
import { ConversationService } from "../src/conversation/conversation-service.js";
import { PromptStore } from "../src/conversation/prompt-store.js";
import { VoiceService, NoSpeechError } from "../src/conversation/voice-service.js";
import { COACHING_SENTINEL } from "../src/conversation/coaching.js";
import { DEFAULT_SCENARIO } from "../src/conversation/scenarios.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(HERE, "../prompts/tutor");
const LANGUAGE: LanguageProfile = {
  target: "tl",
  targetLabel: "Tagalog",
  base: "en",
  baseLabel: "English",
  registers: ["conversational", "taglish", "formal-po"],
};

class FakeSTT implements STTProvider {
  readonly name = "fake-stt";
  readonly mode = "stub" as const;
  lastInput?: AudioInput;
  constructor(private readonly transcript: string) {}
  async transcribe(input: AudioInput): Promise<STTResult> {
    this.lastInput = input;
    return {
      transcript: this.transcript,
      languageCode: input.languageCode,
      confidence: 0.88,
      words: [],
      provider: "fake-stt",
      durationMs: 1000,
    };
  }
}

class FakeTTS implements TTSProvider {
  readonly name = "fake-tts";
  readonly mode = "stub" as const;
  lastRequest?: TTSRequest;
  async synthesize(req: TTSRequest): Promise<TTSResult> {
    this.lastRequest = req;
    return {
      audio: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      voiceId: "fake-voice",
      provider: "fake-tts",
      durationMs: 0,
    };
  }
}

class FakeLLM implements LLMProvider {
  readonly name = "fake";
  readonly mode = "stub" as const;
  constructor(private readonly reply: string) {}
  async complete(_req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    return { text: this.reply, model: "fake-1" };
  }
}

function newSession(): Session {
  const now = new Date().toISOString();
  return {
    id: "voice-session",
    scenario: DEFAULT_SCENARIO,
    learnerState: { level: "building", baseLanguage: "en", weakSpots: [] },
    utterances: [],
    createdAt: now,
    updatedAt: now,
  };
}

function makeVoice(transcript: string, reply: string) {
  const stt = new FakeSTT(transcript);
  const tts = new FakeTTS();
  const conversation = new ConversationService(
    new FakeLLM(reply),
    new PromptStore(PROMPTS_DIR),
    LANGUAGE,
  );
  return { stt, tts, voice: new VoiceService(stt, tts, conversation, LANGUAGE) };
}

describe("VoiceService", () => {
  it("runs the full spoken loop: transcribe → reply → speak", async () => {
    const reply = `Ay, kumusta apo!\n${COACHING_SENTINEL}\n${JSON.stringify({
      corrections: [],
      pronunciation: null,
      register: null,
      newPhrase: null,
      level: "building",
      encouragement: null,
    })}`;
    const { stt, tts, voice } = makeVoice("Kumusta po kayo?", reply);
    const session = newSession();

    const res = await voice.runVoiceTurn(session, new Uint8Array([9, 9]), "audio/m4a");

    expect(res.transcript).toBe("Kumusta po kayo?");
    expect(res.transcriptConfidence).toBeCloseTo(0.88);
    expect(res.reply).toBe("Ay, kumusta apo!");
    expect(res.audioMimeType).toBe("audio/mpeg");
    // audio round-trips through base64
    expect(Buffer.from(res.audioBase64, "base64")).toEqual(Buffer.from([1, 2, 3, 4]));

    // STT got the target language; TTS spoke the reply text only (no sentinel)
    expect(stt.lastInput?.languageCode).toBe("tl");
    expect(tts.lastRequest?.text).toBe("Ay, kumusta apo!");

    // Transcript recorded on the session
    expect(session.utterances.map((u) => u.role)).toEqual(["learner", "tutor"]);
    expect(session.utterances[0]!.text).toBe("Kumusta po kayo?");
  });

  it("throws NoSpeechError on an empty transcript (no LLM/TTS call)", async () => {
    const { tts, voice } = makeVoice("   ", "should not be used");
    await expect(
      voice.runVoiceTurn(newSession(), new Uint8Array([0]), "audio/m4a"),
    ).rejects.toBeInstanceOf(NoSpeechError);
    expect(tts.lastRequest).toBeUndefined();
  });
});
