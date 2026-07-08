/**
 * Minimal xAI (Grok) chat client. Node runtime only.
 *
 * Uses the OpenAI-compatible endpoint at api.x.ai. The API key is read from
 * GROK_API_KEY and NEVER leaves the server. Each call is bounded by an
 * AbortController timeout so a slow upstream can't hang the request path.
 */

const GROK_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = process.env.GROK_MODEL || "grok-2-latest";
const TIMEOUT_MS = 25_000;

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export function grokConfigured(): boolean {
  return Boolean(process.env.GROK_API_KEY);
}

export interface GrokResult {
  reply: string | null;
  error: string | null;
}

export async function grokChat(messages: ChatTurn[]): Promise<GrokResult> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) return { reply: null, error: "GROK_API_KEY not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 600,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { reply: null, error: `Grok HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return { reply: null, error: "Empty response from Grok" };
    return { reply, error: null };
  } catch (err: any) {
    const message = err?.name === "AbortError" ? "Grok request timed out" : String(err?.message || err);
    return { reply: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
