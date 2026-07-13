/**
 * Withdrawal email notifications (Node runtime only).
 *
 * Renders the React Email templates in src/emails/ to HTML with
 * @react-email/render, then sends through the existing resilient Resend wrapper
 * (src/lib/email.ts → sendEmail). Every send is logged to EmailLog (best-effort;
 * a logging failure never blocks the send, and a send failure never throws to
 * the caller — withdrawals must proceed even if email is down).
 */
import { render } from "@react-email/render";
import { sendEmail } from "./email";
import { logEmail } from "./email-log";
import WithdrawalRequestEmail from "@/emails/WithdrawalRequest";
import WithdrawalApprovedEmail from "@/emails/WithdrawalApproved";

/** Split a single display name into first + last. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "there", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** "USDT_TRC20" → "USDT (TRC20)". */
export function formatPayoutMethod(network: string): string {
  if (network === "USDT_TRC20") return "USDT (TRC20)";
  if (network === "USDT_BEP20") return "USDT (BEP20)";
  return network;
}

/** Date → "DD-MM-YYYY" (Manila). */
export function formatDMY(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

export interface WithdrawalRequestEmailInput {
  userId?: string | null;
  email: string;
  name: string;
  username: string | null;
  amount: number;
  network: string;
  address: string;
  dateRequested?: Date;
}

/** Send the "Withdrawal Request — Pending Review" email. Never throws. */
export async function sendWithdrawalRequestEmail(input: WithdrawalRequestEmailInput): Promise<void> {
  const subject = "QuantumX Withdrawal Request Received - Pending Review";
  try {
    const { firstName, lastName } = splitName(input.name);
    const html = await render(
      <WithdrawalRequestEmail
        firstName={firstName}
        lastName={lastName}
        username={input.username || "—"}
        amount={input.amount}
        payoutMethod={formatPayoutMethod(input.network)}
        walletAddress={input.address}
        dateRequested={formatDMY(input.dateRequested ?? new Date())}
      />,
      { pretty: false }
    );
    const res = await sendEmail({ to: input.email, subject, html });
    await logEmail({
      userId: input.userId,
      type: "withdrawal_pending",
      to: input.email,
      subject,
      status: res.delivered ? "sent" : "failed",
      resendId: res.id,
      error: res.error,
    });
  } catch (e: any) {
    console.error("[withdrawal-email] request send failed:", e?.message || e);
    await logEmail({
      userId: input.userId,
      type: "withdrawal_pending",
      to: input.email,
      subject,
      status: "failed",
      error: String(e?.message || e),
    });
  }
}

export interface WithdrawalApprovedEmailInput {
  userId?: string | null;
  email: string;
  name: string;
  username: string | null;
  amount: number;
  network: string;
  address: string;
  transactionHash: string;
  dateApproved?: Date;
}

/** Send the "Withdrawal Approved — Funds Sent" email. Never throws. */
export async function sendWithdrawalApprovedEmail(input: WithdrawalApprovedEmailInput): Promise<void> {
  const subject = "QuantumX Withdrawal Approved - Funds Sent";
  try {
    const { firstName, lastName } = splitName(input.name);
    const html = await render(
      <WithdrawalApprovedEmail
        firstName={firstName}
        lastName={lastName}
        username={input.username || "—"}
        amount={input.amount}
        payoutMethod={formatPayoutMethod(input.network)}
        walletAddress={input.address}
        dateApproved={formatDMY(input.dateApproved ?? new Date())}
        transactionHash={input.transactionHash}
      />,
      { pretty: false }
    );
    const res = await sendEmail({ to: input.email, subject, html });
    await logEmail({
      userId: input.userId,
      type: "withdrawal_approved",
      to: input.email,
      subject,
      status: res.delivered ? "sent" : "failed",
      resendId: res.id,
      error: res.error,
    });
  } catch (e: any) {
    console.error("[withdrawal-email] approved send failed:", e?.message || e);
    await logEmail({
      userId: input.userId,
      type: "withdrawal_approved",
      to: input.email,
      subject,
      status: "failed",
      error: String(e?.message || e),
    });
  }
}
