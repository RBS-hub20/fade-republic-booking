import type {
  LanguageProfile,
  STTProvider,
  Session,
  TTSProvider,
  VoiceTurnResponse,
} from "@lola/shared";
import type { ConversationService } from "./conversation-service.js";

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
  ) {}

  async runVoiceTurn(
    session: Session,
    audio: Uint8Array,
    mimeType: string,
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
      audioBase64: Buffer.from(speech.audio).toString("base64"),
      audioMimeType: speech.mimeType,
    };
  }
}
