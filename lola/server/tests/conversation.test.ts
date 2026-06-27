import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  LanguageProfile,
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMProvider,
  Session,
} from "@lola/shared";
import { ConversationService } from "../src/conversation/conversation-service.js";
import { PromptStore } from "../src/conversation/prompt-store.js";
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

/** A fake LLM that records the request and returns a scripted reply+coaching. */
class FakeLLM implements LLMProvider {
  readonly name = "fake";
  readonly mode = "stub" as const;
  lastRequest?: LLMCompletionRequest;
  constructor(private readonly reply: string) {}
  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    this.lastRequest = req;
    return { text: this.reply, model: "fake-1" };
  }
}

function newSession(): Session {
  const now = new Date().toISOString();
  return {
    id: "test-session",
    scenario: DEFAULT_SCENARIO,
    learnerState: { level: "building", baseLanguage: "en", weakSpots: ["ng sound"] },
    utterances: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe("ConversationService", () => {
  it("renders the active prompt with scenario + learner state injected", () => {
    const llm = new FakeLLM("");
    const svc = new ConversationService(llm, new PromptStore(PROMPTS_DIR), LANGUAGE);
    const system = svc.renderSystemPrompt(newSession());

    expect(system).toContain("Tagalog");
    expect(system).toContain(DEFAULT_SCENARIO.persona);
    expect(system).toContain("building"); // learner level
    expect(system).toContain("ng sound"); // weak spot
    expect(system).toContain(COACHING_SENTINEL);
    expect(system).not.toContain("{{"); // all placeholders resolved
  });

  it("records the turn, splits coaching, and adapts the level", async () => {
    const reply = `Ay, ang galing mo!\n${COACHING_SENTINEL}\n${JSON.stringify({
      corrections: [],
      pronunciation: "soften the ng",
      register: null,
      newPhrase: { phrase: "Mahal kita", meaning: "I love you" },
      level: "conversational",
      encouragement: "Tuloy lang!",
    })}`;
    const llm = new FakeLLM(reply);
    const svc = new ConversationService(llm, new PromptStore(PROMPTS_DIR), LANGUAGE);
    const session = newSession();

    const result = await svc.sendLearnerMessage(session, "Kumusta po kayo?");

    expect(result.reply).toBe("Ay, ang galing mo!");
    expect(result.coaching?.pronunciation).toBe("soften the ng");
    expect(result.level).toBe("conversational");

    // Level adapted on the session itself
    expect(session.learnerState.level).toBe("conversational");

    // Transcript has learner + tutor turns; tutor text is clean (no sentinel)
    expect(session.utterances.map((u) => u.role)).toEqual(["learner", "tutor"]);
    expect(session.utterances[1]!.text).not.toContain(COACHING_SENTINEL);

    // The model saw the learner's message as a user turn
    expect(llm.lastRequest?.messages.at(-1)).toEqual({
      role: "user",
      content: "Kumusta po kayo?",
    });
  });

  it("keeps the conversation flowing when the model returns no coaching", async () => {
    const llm = new FakeLLM("Oo naman, apo.");
    const svc = new ConversationService(llm, new PromptStore(PROMPTS_DIR), LANGUAGE);
    const session = newSession();

    const result = await svc.sendLearnerMessage(session, "Salamat!");
    expect(result.reply).toBe("Oo naman, apo.");
    expect(result.coaching).toBeNull();
    expect(result.level).toBe("building"); // unchanged
  });
});
