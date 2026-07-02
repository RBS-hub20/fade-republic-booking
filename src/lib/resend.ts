/**
 * Resend email client. Node runtime only.
 *
 * Implemented with `fetch` (no SDK dependency, serverless-safe) but shaped like
 * the Resend SDK — `resend.emails.send({ from, to, subject, html })` returns
 * `{ data, error }` — so callers read the same way.
 *
 * IMPORTANT: every send is bounded by an AbortController timeout so a slow or
 * hanging Resend request can never stall a serverless function (which would
 * otherwise time out and surface as a generic failure to the user).
 */

export const FROM_EMAIL = process.env.EMAIL_FROM || "QuantumX <noreply@quantumxglobal.online>";

/** Whether a real email provider is configured. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface ResendSendArgs {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface ResendSendResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

// Bound each send so it can't hang the request path.
const SEND_TIMEOUT_MS = 7000;

async function send(args: ResendSendArgs): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { data: null, error: { message: "RESEND_API_KEY not set" } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: args.from || FROM_EMAIL, ...args }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { data: null, error: { message: `Resend HTTP ${res.status}: ${body.slice(0, 300)}` } };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { data: { id: data.id ?? "" }, error: null };
  } catch (err: any) {
    const message = err?.name === "AbortError" ? "Resend request timed out" : String(err?.message || err);
    return { data: null, error: { message } };
  } finally {
    clearTimeout(timer);
  }
}

export const resend = {
  emails: { send },
};
