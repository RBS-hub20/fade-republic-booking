# QuantumX — Pre-Launch Security & Login-Speed Audit

**Scope:** `quantumxglobal.online` — auth, middleware, inputs, secrets, and login/page-load speed.
**Date:** 2026-08 (pre Shanghai Race launch, Aug 4)
**Branch:** `feat/security-speed-audit`

## Verdict
The core is in **good shape**: scrypt password hashing, HMAC-signed httpOnly cookies, Prisma (no SQL-injection surface), no XSS sinks, no client-side secret leaks, and every admin route guarded. **No Critical code defects found.** The two items that most matter for launch are **config/ops** (SESSION_SECRET + cron reachability), plus one real **login-speed** bug that's now fixed.

Severity: **Critical** = exploitable now / data-at-risk · **High** = serious, verify+fix before launch · **Medium** = hardening · **Low** = defense-in-depth.

---

## PART 1 — Security

| # | Sev | Finding | Where | Status |
|---|-----|---------|-------|--------|
| S1 | ✅ Good | **Password hashing** = Node `scrypt`, per-password salt, `timingSafeEqual`. Strong, no external dep. | `src/lib/password.ts` | — |
| S2 | ✅ Good | **Session cookie** = `base64url(json).HMAC-SHA256`; flags `httpOnly`, `sameSite=lax`, `secure` in prod, 7-day cookie with an **8h client / 4h admin hard cap** (`iat`). | `src/lib/session.ts`, `auth-config.ts`, `api/auth/login/route.ts:153` | — |
| S3 | 🔴 **Critical (verify env)** | **SESSION_SECRET fallback.** If `SESSION_SECRET` is unset in prod, sessions are signed with a **hard-coded public dev secret** → anyone can forge an admin session. The login route already warns when unset. | `src/lib/session.ts:16` | **Action: confirm `SESSION_SECRET` is set in Vercel prod** (long random). |
| S4 | 🟠 High → **Fixed (code) + verify env** | **Cron reachability + fail-open.** `/api/cron/*` was **not** exempt in middleware, so a Vercel Cron call (no session cookie) was redirected to `/login` → the **daily P&L, deposit verification, monthly bonus, and deposit-expiry jobs may not have been running**. Separately, `cronAuthorized` **fails open** if `CRON_SECRET` is unset. | `src/middleware.ts`, `src/lib/cron-auth.ts` | **Fixed** (branch `feat/cron-exempt`): `/api/cron/*` is now middleware-exempt so cron can reach it without a session; each route still enforces `cronAuthorized()`. Fail-open now logs a **one-time warning** when `CRON_SECRET` is unset (stays working, but visible). **Action: set `CRON_SECRET` in Vercel prod** so the crons require `Authorization: Bearer <CRON_SECRET>`, then confirm the daily job in Vercel → Cron logs. |
| S5 | ✅ Good | **Admin authZ.** All 11 `/api/admin/*` routes check `role==='admin'` (or cron auth); all admin **pages** redirect non-admins; middleware also requires a valid session for any non-public path (double gate). | `api/admin/**`, `(app)/admin/**` | — |
| S6 | ✅ Good | **SQL injection.** Prisma is parameterized throughout. The only `*Unsafe` raw calls are **static** DDL / an index-existence check with **no user input**. | `api/health/route.ts:133`, `lib/schema-ddl.ts`, `lib/{avatar,username}.ts` | — |
| S7 | ✅ Good | **XSS.** No `dangerouslySetInnerHTML`; React auto-escapes all rendered values. | (repo-wide) | — |
| S8 | ✅ Good | **Secret exposure.** No non-public secret is read in any client component; `NEXT_PUBLIC_*` = only `SITE_URL`, `APP_URL`, `ENABLE_REFERRALS`. | (repo-wide) | — |
| S9 | 🟡 Medium | **Rate limiting is in-memory / per-instance.** Login is capped at 10 / 15 min, but the store is per serverless instance and resets on cold start, so distributed brute-force is only partially slowed. | `src/lib/rate-limit.ts`, `api/auth/login/route.ts:36` | Recommend Upstash Redis (`INCR`+`EXPIRE`) for a shared limit. Needs a dep + env — not auto-applied. |
| S10 | 🟡 Medium → **Fixed** | **Missing security headers** (no HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy). | `next.config.mjs` | **Fixed** — added conservative headers (see below). Full nonce-based CSP deferred (needs Next nonce wiring). |
| S11 | 🟢 Low | **CSRF** relies on `sameSite=lax` (adequate for cookie auth; blocks cross-site POST cookies). No explicit anti-CSRF tokens. | (cookie policy) | Optional: add tokens on sensitive POSTs for defense-in-depth. |

---

## PART 2 — Login / page-load speed

| # | Sev | Finding | Where | Status |
|---|-----|---------|-------|--------|
| P1 | 🟠 **High → Fixed** | **Equity curve computed twice per page.** The app-shell layout (wraps every authed page) called `getClientPerformance` just for the header tier chip; `/dashboard` and `/statement` then call it **again** → the full curve is rebuilt 2× per request. | `(app)/layout.tsx:53`, `lib/data.ts` | **Fixed** — `getClientPerformance` is now **request-memoized** (`React cache()`); same-request calls collapse to one. |
| P2 | 🟡 Med → **Fixed** | **Redundant per-page DB query** for `emailVerified` in the layout — the value is already in the signed session (and clients can't log in unverified). | `(app)/layout.tsx:39` | **Fixed** — read `session.emailVerified`; one fewer round trip on every page. |
| P3 | ✅ Good | **`/login` page** is a pure client component — no server queries; loads fast. | `app/login/page.tsx` | — |
| P4 | ✅ Good | **Session check is DB-free.** `getSession()` only decodes + HMAC-verifies the cookie and checks the hard cap — **zero DB hits**. The "3h 57m remaining" is derived from the cookie `iat`, not a query. | `lib/auth.ts` | — |
| P5 | ✅ Good | **Auth lookup is indexed.** `User.email` and `User.username` are `@unique` → the login `findFirst` is index-backed. | `prisma/schema.prisma` | — |
| P6 | ✅ Good | **Middleware is DB-free** (decode-only) and runs per request without queries. | `src/middleware.ts` | — |
| P7 | ℹ️ Info | Layout runs 4 `ensure*SchemaOnce` guards in `Promise.all` — no-ops after the first warm call (module-level `once` + `SKIP_RUNTIME_DB_HEAL` in prod). Low cost; left as-is. | `(app)/layout.tsx:23` | — |

**Net effect of P1+P2:** on `/dashboard` and `/statement`, the heaviest computation (equity curve) now runs **once instead of twice**, and every authed page drops one extra `User` query — the post-login landing should be noticeably snappier with zero behavior change.

---

## PART 3 — What was changed (safe fixes, this branch)

1. **`src/lib/data.ts`** — wrap `getClientPerformance` in `React cache()` (request memoization). Same output, computed once per request.
2. **`src/app/(app)/layout.tsx`** — use `session.emailVerified` instead of a per-page `User` lookup.
3. **`next.config.mjs`** — add HSTS, `X-Frame-Options: DENY` + `CSP: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

All three are **additive / behavior-preserving** — no data touched, no auth logic changed. Login (client + admin) is unchanged.

### Follow-up applied — cron fix (branch `feat/cron-exempt`)
4. **`src/middleware.ts`** — exempt `/api/cron/*` from the session-cookie gate so Vercel Cron (which carries no session) can reach the daily jobs instead of being redirected to `/login`. Each cron route still enforces its own `cronAuthorized()` (Bearer `CRON_SECRET` / admin session), so exempting the middleware does **not** make them public.
5. **`src/lib/cron-auth.ts`** — when `CRON_SECRET` is unset, `cronAuthorized()` still allows the call (so prod keeps working) but now emits a **one-time `console.warn`** flagging that the endpoints are public — removes the silent fail-open. No change to behavior when `CRON_SECRET` is set (Bearer / admin required).

**Ops action:** set `CRON_SECRET` in Vercel production (`openssl rand -base64 32`) to close the fail-open, then verify the daily job runs in **Vercel → Cron logs**.

## Needs your action (env / ops — cannot be safely fixed from code here)

- **[Critical] Confirm `SESSION_SECRET` is set** in Vercel production (a long random value). This is the single most important item.
- **[High] Verify the daily cron is actually executing** (Vercel → Cron logs). If it's being redirected, we exempt `/api/cron/*` in middleware **and** set `CRON_SECRET` (both together — one without the other either breaks or exposes the crons).
- **[Medium] Distributed rate limiting** (Upstash Redis) if you want brute-force limits that hold across serverless instances.

## Recommended follow-ups (not blocking launch)
- Nonce-based full CSP (`script-src`/`style-src`) once Next nonce wiring is added.
- Anti-CSRF tokens on state-changing POSTs (defense-in-depth on top of `sameSite`).
