import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMProvider,
} from "@lola/shared";

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
    const coaching = {
      corrections: echo
        ? [
            {
              heard: echo,
              suggestion: echo,
              why: "(stub) Looks natural — keep going.",
            },
          ]
        : [],
      pronunciationNote: "(stub) Your vowels are landing clearly.",
      newPhrase: { phrase: "Mahal kita", meaning: "I love you" },
      level: "scaffolding",
    };

    const text = `${reply}\n${JSON.stringify(coaching)}`;
    return {
      text,
      model: req.model ?? "stub-tutor-1",
      stopReason: "end_turn",
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
