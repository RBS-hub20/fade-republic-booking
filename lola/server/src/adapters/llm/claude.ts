import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMProvider,
} from "@lola/shared";

/**
 * Live LLM adapter for Anthropic Claude — the only place the Anthropic SDK is
 * imported. Conversation runs on claude-sonnet-4-6 (per the product brief).
 *
 * Replies are short and latency-sensitive, so we keep thinking off and
 * max_tokens modest; the call is non-streaming because outputs are small.
 */
export class ClaudeLLMProvider implements LLMProvider {
  readonly name = "claude";
  readonly mode = "live" as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const messages: Anthropic.MessageParam[] = req.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await this.client.messages.create({
      model: req.model ?? this.defaultModel,
      max_tokens: req.maxTokens ?? 1024,
      system: req.system,
      messages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      model: response.model,
      stopReason: response.stop_reason ?? undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
