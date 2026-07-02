/**
 * Higher-level transactional email helpers (create token in DB + send).
 * Node runtime only. Returns a `devLink` when no provider is configured and not
 * in production, so flows are testable locally without email.
 */
import { prisma } from "./prisma";
import { generateToken, appBaseUrl, TOKEN_TYPES } from "./tokens";
import { sendEmail, emailConfigured, emailTemplate } from "./email";
import { METHOD_LABELS, type TransactionMethod } from "./constants";
import { formatUsd } from "./utils";

const DAY = 24 * 60 * 60 * 1000;

/** Notify a client that their deposit was approved/credited. Best-effort. */
export async function notifyDepositApproved(opts: {
  email: string;
  name: string;
  amount: number;
  method: string;
  auto: boolean;
}): Promise<void> {
  const label = METHOD_LABELS[opts.method as TransactionMethod] ?? opts.method;
  await sendEmail({
    to: opts.email,
    subject: `Deposit confirmed — ${formatUsd(opts.amount)} credited`,
    html: emailTemplate({
      heading: `Deposit confirmed, ${opts.name.split(" ")[0]}!`,
      body:
        `Your deposit of <strong>${formatUsd(opts.amount)}</strong> via ${label} has been ` +
        `${opts.auto ? "automatically verified on-chain and " : ""}credited to your QuantumX account. ` +
        `Log in to view your updated balance.`,
      buttonLabel: "Open dashboard",
      buttonUrl: `${appBaseUrl()}/dashboard`,
    }),
  });
}

/** Notify a client that their withdrawal has been paid out. Best-effort. */
export async function notifyWithdrawalApproved(opts: {
  email: string;
  name: string;
  amount: number;
  method: string;
}): Promise<void> {
  const label = METHOD_LABELS[opts.method as TransactionMethod] ?? opts.method;
  await sendEmail({
    to: opts.email,
    subject: `Payout sent — ${formatUsd(opts.amount)}`,
    html: emailTemplate({
      heading: `Payout sent, ${opts.name.split(" ")[0]}!`,
      body:
        `Your withdrawal of <strong>${formatUsd(opts.amount)}</strong> via ${label} has been ` +
        `approved and sent. It has been debited from your QuantumX balance.`,
      buttonLabel: "Open dashboard",
      buttonUrl: `${appBaseUrl()}/dashboard`,
    }),
  });
}

export async function createAndSendVerification(user: {
  id: string;
  email: string;
  name: string;
}): Promise<{ devLink?: string }> {
  await prisma.authToken.deleteMany({
    where: { userId: user.id, type: TOKEN_TYPES.EMAIL_VERIFY },
  });

  const { raw, hash } = generateToken();
  await prisma.authToken.create({
    data: {
      userId: user.id,
      type: TOKEN_TYPES.EMAIL_VERIFY,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + DAY),
    },
  });

  const link = `${appBaseUrl()}/api/auth/verify?token=${raw}`;
  const result = await sendEmail({
    to: user.email,
    subject: "Verify your QuantumX email",
    html: emailTemplate({
      heading: `Welcome, ${user.name.split(" ")[0]}!`,
      body: "Please confirm your email address to finish setting up your QuantumX Global Markets account.",
      buttonLabel: "Verify email",
      buttonUrl: link,
    }),
  });

  if (!result.delivered && !emailConfigured() && process.env.NODE_ENV !== "production") {
    return { devLink: link };
  }
  return {};
}
