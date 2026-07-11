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

/** Notify a client their earnings withdrawal is complete, with the TX hash. */
export async function notifyWithdrawalCompleted(opts: {
  email: string;
  name: string;
  amount: number;
  fee: number;
  receiveAmount: number;
  network: string; // USDT_BEP20 | USDT_TRC20
  address: string;
  txHash: string;
}): Promise<void> {
  const net = opts.network === "USDT_TRC20" ? "TRC20" : "BEP20";
  const explorer =
    net === "TRC20"
      ? `https://tronscan.org/#/transaction/${opts.txHash}`
      : `https://bscscan.com/tx/${opts.txHash}`;
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const body = `Your withdrawal request has been processed!<br/><br/>
    <strong>Amount Requested:</strong> ${formatUsd(opts.amount)}<br/>
    <strong>Fee (3%):</strong> ${formatUsd(opts.fee)}<br/>
    <strong>Amount Sent:</strong> ${formatUsd(opts.receiveAmount)}<br/>
    <strong>Network:</strong> ${net} USDT<br/>
    <strong>Wallet:</strong> ${opts.address}<br/><br/>
    <strong>Transaction Hash:</strong><br/>${opts.txHash}<br/><br/>
    Verify on the blockchain using the button below.<br/><br/>
    <strong>Status:</strong> Completed<br/>
    <strong>Processed:</strong> ${when} PHT`;
  await sendEmail({
    to: opts.email,
    subject: "Withdrawal Approved - QuantumX",
    html: emailTemplate({
      heading: `Withdrawal complete, ${opts.name.split(" ")[0]}!`,
      body,
      buttonLabel: "Verify on Blockchain",
      buttonUrl: explorer,
    }),
  });
}

/** Notify a client their withdrawal was rejected and the amount refunded. */
export async function notifyWithdrawalRejected(opts: {
  email: string;
  name: string;
  amount: number;
  reason: string;
}): Promise<void> {
  await sendEmail({
    to: opts.email,
    subject: "Withdrawal Rejected",
    html: emailTemplate({
      heading: `Withdrawal update, ${opts.name.split(" ")[0]}`,
      body:
        `Your withdrawal request of <strong>${formatUsd(opts.amount)}</strong> was not approved.<br/><br/>` +
        `<strong>Reason:</strong> ${opts.reason}<br/><br/>` +
        `The amount has been refunded to your Available Withdrawal balance.`,
      buttonLabel: "Open dashboard",
      buttonUrl: `${appBaseUrl()}/dashboard`,
    }),
  });
}

/** Notify a client that a locked capital deposit has matured. */
export async function notifyCapitalMatured(opts: {
  email: string;
  name: string;
  amount: number;
}): Promise<void> {
  await sendEmail({
    to: opts.email,
    subject: `Your ${formatUsd(opts.amount)} capital has matured 🎉`,
    html: emailTemplate({
      heading: `Capital matured, ${opts.name.split(" ")[0]}!`,
      body:
        `Your locked capital of <strong>${formatUsd(opts.amount)}</strong> has completed its ` +
        `6-month term. You can now withdraw it to your wallet or renew it for another 6 months from your dashboard.`,
      buttonLabel: "Choose an action",
      buttonUrl: `${appBaseUrl()}/dashboard`,
    }),
  });
}

/**
 * Alert the admin when the daily P/L job fails or leaves a gap. Sent to
 * ADMIN_ALERT_EMAIL (falls back to the platform admin address). Best-effort.
 */
export async function notifyDailyPerfIssue(opts: {
  detail: string;
  lastPosted: string | null;
  expected: string;
  clientsAffected: number;
}): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL || "admin@quantumxglobal.com";
  await sendEmail({
    to,
    subject: `⚠️ Daily P/L alert — ${opts.clientsAffected} client(s) missing an entry`,
    html: emailTemplate({
      heading: "Daily P/L posting issue",
      body:
        `${opts.detail}<br><br>` +
        `Last posted: <strong>${opts.lastPosted ?? "never"}</strong> · ` +
        `Expected through: <strong>${opts.expected}</strong> · ` +
        `Clients affected: <strong>${opts.clientsAffected}</strong>.<br><br>` +
        `The nightly engine auto-backfills gaps on its next run. To fill it now, ` +
        `open Admin → Fund Performance and click “Backfill now”.`,
      buttonLabel: "Open Fund Performance",
      buttonUrl: `${appBaseUrl()}/admin/performance`,
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
