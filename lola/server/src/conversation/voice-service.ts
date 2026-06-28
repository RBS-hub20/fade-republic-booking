import type {
  LanguageProfile,
  PronunciationReport,
  STTProvider,
  Session,
  TTSProvider,
  VoiceTurnResponse,
} from "@lola/shared";
import type { ConversationService } from "./conversation-service.js";
import { PronunciationScorer } from "../pronunciation/scorer.js";
import { deriveWeakSpots, updatePhonemeStats } from "../pronunciation/weak-spots.js";

/** Thrown when the audio contained no recognisable speech. */
export class NoSpeechError extends Error {
  constructor() {
    super("no_speech");
    this.name = "NoSpeechError";
  }
}

/**
 * Orchestrates one full spoken turn: transcribe the learner's audio (STT), run
 * the text conversation loop, then speak the tutor's reply (TTS). Each provider
 * sits behind its interface, so vendors swap without touching this flow.
 */
export class VoiceService {
  constructor(
    private readonly stt: STTProvider,
    private readonly tts: TTSProvider,
    private readonly conversation: ConversationService,
    private readonly language: LanguageProfile,
    private readonly scorer: PronunciationScorer = new PronunciationScorer(),
  ) {}

  async runVoiceTurn(
    session: Session,
    audio: Uint8Array,
    mimeType: string,
    target?: string,
  ): Promise<VoiceTurnResponse> {
    const stt = await this.stt.transcribe({
      bytes: audio,
      mimeType,
      languageCode: this.language.target,
    });

    const transcript = stt.transcript.trim();
    if (transcript.length === 0) {
      throw new NoSpeechError();
    }

    const turn = await this.conversation.sendLearnerMessage(session, transcript);

    // Score pronunciation against the best available target, then fold the
    // result into the learner's running per-phoneme stats and resurface the
    // weakest sounds (which the tutor prompt picks up next turn).
    const pronunciation = this.scoreTurn(transcript, turn.coaching, stt.confidence, target);
    session.learnerState.phonemeStats = updatePhonemeStats(
      session.learnerState.phonemeStats,
      pronunciation,
    );
    session.learnerState.weakSpots = deriveWeakSpots(session.learnerState.phonemeStats);

    const speech = await this.tts.synthesize({
      text: turn.reply,
      languageCode: this.language.target,
    });

    return {
      transcript,
      transcriptConfidence: stt.confidence,
      reply: turn.reply,
      coaching: turn.coaching,
      level: turn.level,
      utterance: turn.utterance,
      pronunciation,
      audioBase64: Buffer.from(speech.audio).toString("base64"),
      audioMimeType: speech.mimeType,
    };
  }

  /**
   * Chooses what to score the utterance against, in priority order:
   *   1. an explicit drill target ("repeat after me"),
   *   2. the native form from the tutor's first correction,
   *   3. the transcript itself (tracks which sounds they're practising).
   */
  private scoreTurn(
    transcript: string,
    coaching: VoiceTurnResponse["coaching"],
    confidence: number,
    explicitTarget?: string,
  ): PronunciationReport {
    const correction = coaching?.corrections?.[0]?.better?.trim();
    const target = explicitTarget?.trim() || correction || transcript;
    return this.scorer.score({ target, heard: transcript, confidence });
  }
}
