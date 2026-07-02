/**
 * Pluggable email sender. Node runtime only.
 *
 * - If RESEND_API_KEY is set, sends via the Resend HTTP API (no SDK dependency,
 *   works on serverless). Set EMAIL_FROM to a verified sender.
 * - Otherwise, "dev mode": logs the message + link to the server console and
 *   reports delivered:false so callers can surface a dev link locally.
 *
 * To use another provider (SendGrid, Postmark, SMTP), swap the send() body.
 */

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  delivered: boolean;
  provider: "resend" | "console";
  error?: string;
}

const FROM = process.env.EMAIL_FROM || "QuantumX Global Markets <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev fallback — no provider configured.
    console.log(
      `\n📧 [email:dev] To: ${to}\n   Subject: ${subject}\n   (set RESEND_API_KEY to actually send)\n`
    );
    return { delivered: false, provider: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend send failed:", res.status, body);
      return { delivered: false, provider: "resend", error: `HTTP ${res.status}` };
    }
    return { delivered: true, provider: "resend" };
  } catch (err: any) {
    console.error("Resend send error:", err?.message);
    return { delivered: false, provider: "resend", error: err?.message };
  }
}

/** Whether a real email provider is configured. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Simple branded HTML wrapper for transactional emails. */
export function emailTemplate(opts: {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
}): string {
  return `
  <div style="background:#0f1116;padding:32px;font-family:system-ui,sans-serif;color:#e5e7eb">
    <div style="max-width:480px;margin:0 auto;background:#181b21;border:1px solid #2d333d;border-radius:12px;overflow:hidden">
      <div style="background:#e0b54a;color:#000;padding:16px 24px;font-weight:800;font-size:18px">
        QuantumX Global Markets
      </div>
      <div style="padding:24px">
        <h1 style="font-size:18px;margin:0 0 12px">${opts.heading}</h1>
        <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 20px">${opts.body}</p>
        <a href="${opts.buttonUrl}" style="display:inline-block;background:#e0b54a;color:#000;text-decoration:none;font-weight:600;padding:10px 20px;border-radius:8px">${opts.buttonLabel}</a>
        <p style="color:#6b7280;font-size:12px;margin:20px 0 0;word-break:break-all">Or paste this link: ${opts.buttonUrl}</p>
      </div>
    </div>
  </div>`;
}
