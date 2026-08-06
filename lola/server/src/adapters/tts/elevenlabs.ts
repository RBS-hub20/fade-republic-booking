import type { TTSProvider, TTSRequest, TTSResult } from "@lola/shared";

/**
 * A public ElevenLabs voice used when none is configured. The multilingual model
 * lets any voice speak Tagalog; override with LOLA_TTS_VOICE_ID for a voice that
 * better fits "lola".
 */
export const DEFAULT_ELEVEN_VOICE = "21m00Tcm4TlvDq8ikWAM";

/**
 * Live TTS adapter for ElevenLabs. The only place the ElevenLabs API is called.
 * Uses the multilingual model so the tutor's Tagalog sounds natural.
 */
export class ElevenLabsTTSProvider implements TTSProvider {
  readonly name = "elevenlabs";
  readonly mode = "live" as const;

  constructor(
    private readonly apiKey: string,
    private readonly defaultVoiceId = DEFAULT_ELEVEN_VOICE,
    private readonly model = "eleven_multilingual_v2",
    private readonly baseUrl = "https://api.elevenlabs.io/v1",
  ) {}

  async synthesize(req: TTSRequest): Promise<TTSResult> {
    const voiceId = req.voiceId ?? this.defaultVoiceId;
    const res = await fetch(
      `${this.baseUrl}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: req.text,
          model_id: this.model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`[lola] ElevenLabs synthesis failed (${res.status}): ${await res.text()}`);
    }

    const audio = new Uint8Array(await res.arrayBuffer());
    return {
      audio,
      mimeType: "audio/mpeg",
      voiceId,
      provider: "elevenlabs",
      durationMs: 0, // not reported by the API
    };
  }
}
