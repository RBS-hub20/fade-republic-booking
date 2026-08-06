import { randomUUID } from "node:crypto";
import type {
  LanguageProfile,
  LLMMessage,
  LLMProvider,
  Session,
  SendMessageResponse,
  Utterance,
} from "@lola/shared";
import { PromptStore } from "./prompt-store.js";
import { COACHING_SENTINEL, parseTutorMessage } from "./coaching.js";

/**
 * The conversation engine. Owns the turn: render the (versioned) system prompt
 * with the live scenario + learner state, send the full transcript to the LLM,
 * split the reply from the coaching, persist the tutor turn, and adapt the
 * learner's level for next time.
 */
export class ConversationService {
  constructor(
    private readonly llm: LLMProvider,
    private readonly prompts: PromptStore,
    private readonly language: LanguageProfile,
  ) {}

  /**
   * Appends the learner's message, asks the tutor, records the reply + coaching,
   * and updates the learner's level. Mutates `session` in place; the caller
   * persists it.
   */
  async sendLearnerMessage(session: Session, text: string): Promise<SendMessageResponse> {
    const now = new Date().toISOString();
    session.utterances.push({
      id: randomUUID(),
      role: "learner",
      text,
      createdAt: now,
    });

    const system = this.renderSystemPrompt(session);
    const messages = toLLMMessages(session.utterances);

    const result = await this.llm.complete({ system, messages, maxTokens: 1024 });
    const { reply, coaching } = parseTutorMessage(result.text);

    // Adapt the learner's level from the tutor's read of this turn.
    if (coaching) {
      session.learnerState.level = coaching.level;
    }

    const tutorUtterance: Utterance = {
      id: randomUUID(),
      role: "tutor",
      text: reply,
      coaching: coaching ?? null,
      createdAt: new Date().toISOString(),
    };
    session.utterances.push(tutorUtterance);
    session.updatedAt = tutorUtterance.createdAt;

    return {
      reply,
      coaching,
      level: session.learnerState.level,
      utterance: tutorUtterance,
    };
  }

  /** Renders the active prompt template with live placeholders. */
  renderSystemPrompt(session: Session): string {
    const { content } = this.prompts.getActiveContent();
    const weakSpots =
      session.learnerState.weakSpots.length > 0
        ? session.learnerState.weakSpots.join(", ")
        : "none noted yet";

    const values: Record<string, string> = {
      targetLabel: this.language.targetLabel,
      baseLabel: this.language.baseLabel,
      registers: this.language.registers.join(", "),
      scenarioTitle: session.scenario.title,
      scenarioDescription: session.scenario.description,
      scenarioPersona: session.scenario.persona,
      learnerLevel: session.learnerState.level,
      weakSpots,
      coachingSentinel: COACHING_SENTINEL,
    };

    return content.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
      key in values ? values[key]! : whole,
    );
  }
}

/**
 * Maps the transcript to LLM turns. Tutor turns send only their natural reply
 * (coaching is client-only), so the model sees a clean conversation. The API
 * combines consecutive same-role messages, so this is always valid.
 */
function toLLMMessages(utterances: Utterance[]): LLMMessage[] {
  return utterances.map((u) => ({
    role: u.role === "learner" ? "user" : "assistant",
    content: u.text,
  }));
}
