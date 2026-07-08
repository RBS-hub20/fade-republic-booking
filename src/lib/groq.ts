/**
 * Minimal Groq chat client. Node runtime only.
 *
 * Groq exposes an OpenAI-compatible endpoint. The API key is read from
 * GROQ_API_KEY and NEVER leaves the server. Supports streaming (SSE) responses.
 */

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Overridable so a decommissioned model can be swapped via env without a deploy.
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Open a streaming (SSE) completion. Returns the raw upstream Response so the
 * caller can check `res.ok` and pipe `res.body`. `signal` bounds the request.
 */
export async function groqStream(messages: ChatTurn[], signal: AbortSignal): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  return fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 800,
      stream: true,
    }),
    signal,
  });
}

/**
 * Parse the incremental content out of one Groq SSE `data:` payload.
 * Returns the delta text, or null for keep-alives / the terminal [DONE].
 */
export function parseSseDelta(jsonPayload: string): string | null {
  if (jsonPayload === "[DONE]") return null;
  try {
    const obj = JSON.parse(jsonPayload) as {
      choices?: { delta?: { content?: string } }[];
    };
    return obj.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}
