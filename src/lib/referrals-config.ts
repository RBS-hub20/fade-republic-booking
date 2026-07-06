/**
 * Referral feature flag — safe to import from client, server, and edge code
 * (no node-only imports). `NEXT_PUBLIC_` vars are inlined at build time.
 *
 * Kill-switch: set NEXT_PUBLIC_ENABLE_REFERRALS="false" in the host env to hide
 * every referral surface and disable commission crediting/withdrawals, without
 * a code change. Defaults to ENABLED when the var is unset, so existing
 * deployments keep working.
 */
export const REFERRALS_ENABLED =
  (process.env.NEXT_PUBLIC_ENABLE_REFERRALS ?? "true").toLowerCase() !== "false";
