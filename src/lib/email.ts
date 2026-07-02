/**
 * Higher-level email helper built on the Resend client (src/lib/resend.ts).
 * Node runtime only. Never throws and never hangs — sends are timeout-bounded in
 * the resend client, and errors are returned, not raised, so callers (signup,
 * password reset, etc.) can always proceed.
 */
import { resend, FROM_EMAIL, emailConfigured } from "./resend";

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

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<SendResult> {
  if (!emailConfigured()) {
    // Dev fallback — no provider configured.
    console.log(
      `\n📧 [email:dev] To: ${to}\n   Subject: ${subject}\n   (set RESEND_API_KEY to actually send)\n`
    );
    return { delivered: false, provider: "console" };
  }

  const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html, text });
  if (error) {
    console.error("Resend send failed:", error.message);
    return { delivered: false, provider: "resend", error: error.message };
  }
  console.log(`📧 Resend delivered to ${to} (id: ${data?.id})`);
  return { delivered: true, provider: "resend" };
}

export { emailConfigured } from "./resend";

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
