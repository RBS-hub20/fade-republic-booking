/**
 * XENA LLM provider abstraction. Node runtime only.
 *
 * Both OpenAI and Groq expose the SAME OpenAI-compatible streaming (SSE) chat
 * API, so a single SSE parser (see parseSseDelta in ./groq) consumes either.
 *
 * Strategy: if OPENAI_API_KEY is set, use OpenAI (gpt-4o-mini) first; on ANY
 * failure (network throw, or a non-OK HTTP status like 429/5xx) fall back to
 * Groq. If OpenAI isn't configured, go straight to Groq. This keeps XENA up when
 * one provider is rate-limited, decommissions a model, or has an outage.
 */
import { groqStream, groqConfigured, GROQ_MODEL, type ChatTurn } from "./groq";

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** True when at least one provider has a usable key. */
export function llmConfigured(): boolean {
  return openaiConfigured() || groqConfigured();
}

async function openaiStream(messages: ChatTurn[], signal: AbortSignal): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  return fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 800,
      stream: true,
    }),
    signal,
  });
}

/**
 * Open a streaming completion from the best available provider. Returns the raw
 * upstream Response (SSE) — the caller checks `res.ok` and pipes `res.body`,
 * exactly as before. OpenAI is tried first (when configured); any failure falls
 * back to Groq so a single provider hiccup never takes XENA down.
 */
export async function llmStream(messages: ChatTurn[], signal: AbortSignal): Promise<Response> {
  if (openaiConfigured()) {
    try {
      console.log("[XENA] provider: openai model:", OPENAI_MODEL);
      const res = await openaiStream(messages, signal);
      if (res.ok && res.body) return res;
      // Non-OK (e.g. 429 quota, 401 bad key, 5xx) → log + fall back to Groq.
      const body = await res.text().catch(() => "");
      console.error(`[XENA] OpenAI HTTP ${res.status}, falling back to Groq:`, body.slice(0, 300));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // A caller-triggered abort (timeout) must NOT trigger a fallback retry.
      if (signal.aborted) throw e;
      console.error("[XENA] OpenAI request failed, falling back to Groq:", msg);
    }
  }
  console.log("[XENA] provider: groq model:", GROQ_MODEL);
  return groqStream(messages, signal);
}
