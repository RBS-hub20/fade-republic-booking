import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMProvider,
} from "@lola/shared";
import { COACHING_SENTINEL } from "../../conversation/coaching.js";

/**
 * Stub LLM adapter. Returns well-typed, deterministic fake data so the full
 * loop is exercisable before the real Claude adapter lands in Phase 2.
 *
 * It loosely mimics the tutor contract: a warm Tagalog-ish reply, followed by a
 * coaching JSON block, so downstream parsing can be developed against it.
 */
export class StubLLMProvider implements LLMProvider {
  readonly name = "stub";
  readonly mode = "stub" as const;

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
    const echo = lastUser?.content?.slice(0, 80) ?? "";

    const reply = "Ay, ang galing mo! Kumusta ka? Salamat sa pagsasanay.";
    // Mirrors the real tutor contract (sentinel-delimited coaching JSON) so the
    // full loop — including coaching rendering — is exercisable without an API key.
    const coaching = {
      corrections: echo
        ? [{ original: echo, better: echo, note: "(stub) Looks natural — keep going." }]
        : [],
      pronunciation: "(stub) Your vowels are landing clearly.",
      register: null,
      newPhrase: { phrase: "Mahal kita", meaning: "I love you" },
      level: "building",
      encouragement: "(stub) Tuloy lang!",
    };

    const text = `${reply}\n${COACHING_SENTINEL}\n${JSON.stringify(coaching)}`;
    return {
      text,
      model: req.model ?? "stub-tutor-1",
      stopReason: "end_turn",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
