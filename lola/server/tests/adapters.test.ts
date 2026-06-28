import { describe, expect, it } from "vitest";
import type { AudioInput } from "@lola/shared";
import { StubLLMProvider } from "../src/adapters/llm/stub.js";
import { StubSTTProvider } from "../src/adapters/stt/stub.js";
import { StubTTSProvider } from "../src/adapters/tts/stub.js";
import { createProviders } from "../src/adapters/factory.js";
import { loadConfig } from "../src/config/env.js";

describe("StubLLMProvider", () => {
  it("returns a well-typed completion echoing the last user turn", async () => {
    const llm = new StubLLMProvider();
    const res = await llm.complete({
      system: "be warm",
      messages: [{ role: "user", content: "Kumusta?" }],
    });

    expect(res.text.length).toBeGreaterThan(0);
    expect(typeof res.model).toBe("string");
    expect(res.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(llm.mode).toBe("stub");
  });

  it("appends a parseable coaching JSON block on its own line", async () => {
    const llm = new StubLLMProvider();
    const res = await llm.complete({
      system: "be warm",
      messages: [{ role: "user", content: "test" }],
    });
    const lastLine = res.text.trim().split("\n").at(-1)!;
    const coaching = JSON.parse(lastLine);
    expect(coaching).toHaveProperty("corrections");
    expect(coaching).toHaveProperty("newPhrase");
  });
});

describe("StubSTTProvider", () => {
  it("returns a transcript with monotonic word timings", async () => {
    const stt = new StubSTTProvider();
    const input: AudioInput = {
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/m4a",
      languageCode: "tl",
    };
    const res = await stt.transcribe(input);

    expect(res.transcript).toMatch(/\S/);
    expect(res.languageCode).toBe("tl");
    expect(res.confidence).toBeGreaterThan(0);
    expect(res.words.length).toBeGreaterThan(0);
    for (const w of res.words) {
      expect(w.endMs).toBeGreaterThan(w.startMs);
    }
    // timings are non-overlapping and ordered
    for (let i = 1; i < res.words.length; i++) {
      expect(res.words[i]!.startMs).toBeGreaterThanOrEqual(res.words[i - 1]!.endMs);
    }
  });
});

describe("StubTTSProvider", () => {
  it("returns non-empty audio bytes and a matching mime type", async () => {
    const tts = new StubTTSProvider();
    const res = await tts.synthesize({ text: "Mabuhay", languageCode: "tl", format: "mp3" });

    expect(res.audio).toBeInstanceOf(Uint8Array);
    expect(res.audio.byteLength).toBeGreaterThan(0);
    expect(res.mimeType).toBe("audio/mpeg");
    expect(res.voiceId.length).toBeGreaterThan(0);
  });
});

describe("createProviders", () => {
  it("wires a full stub provider set by default (Phase 1)", () => {
    const providers = createProviders(loadConfig());
    expect(providers.llm.mode).toBe("stub");
    expect(providers.stt.mode).toBe("stub");
    expect(providers.tts.mode).toBe("stub");
  });
});
