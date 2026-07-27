# eGov SuperAgent — MVP

> Super Agent. All Services. — The Autonomous eGov OS for 115M Filipinos. Utusan mo lang.

A self-contained demo product that lives alongside the QuantumX app in this
repository. It shares the Next.js 14 App Router runtime, Tailwind config and
`src/components` tree, but nothing else: no database, no auth, no shared state.

## Routes

| Route | What it is |
| --- | --- |
| `/egov` | Landing page — hero, Agent vs SuperAgent comparison, SSS/PhilHealth/PSA previews, trust pillars |
| `/app` | Three-column console — sidebar, chat with generative UI, vault + receipt + memory rail |
| `/api/webhook/messenger` | Messenger webhook prep. `POST` logs the payload and returns `{ ok: true }`; `GET` completes the `hub.challenge` handshake when `MESSENGER_VERIFY_TOKEN` matches |

`/egov` and `/app` are public — both are listed in `src/middleware.ts` so the
session gate leaves them alone.

## Layout of the code

```
mocks/                                sss.json, philhealth.json, psa.json — the only data source
public/logos/                         brand assets (processed) + source/ (original kit exports)
src/app/(egov)/                       route group: eGov metadata, favicon, theme colour
  ├─ egov/page.tsx                    landing
  └─ app/page.tsx                     console
src/app/api/webhook/messenger/        webhook route
src/components/generative-ui/         SSSContributionsCard, PhilHealthCard, PSATrackerCard, card chrome, sketch map
src/components/vault/                 VaultPreview (encrypt / list / decrypt / delete)
src/components/receipts/              AntiFixerReceipt
src/components/egov/                  app shell, sidebar, chat panel, composer, memory graph, landing sections
src/lib/egov/                         brand tokens, typed mock access, agent intents, vault crypto, PDF export
```

## How the chat works

`src/lib/egov/agent.ts` does Taglish-tolerant keyword routing — no model is
involved. An input matching `sss` renders `<SSSContributionsCard>`, `philhealth`
renders `<PhilHealthCard>`, and `psa`/`birth` renders `<PSATrackerCard>`, each
with a Taglish reply and follow-up chips. Unmatched input gets an honest "hindi
ko pa kaya 'yan" with the four connected agencies listed.

The landing preview cards deep-link into the console with a first utos:
`/app?q=check%20my%20sss%20contributions`.

## Vault

`src/lib/egov/vault.ts` is real client-side encryption, not a stub:

- AES-GCM 256 via Web Crypto, fresh 12-byte IV per document.
- The master key is a **non-extractable** `CryptoKey` structured-cloned into
  IndexedDB — usable for decrypt, impossible to export.
- Ciphertext + IV live in IndexedDB; nothing is uploaded.
- Where IndexedDB is unavailable the module falls back to localStorage, which
  requires an extractable key. That is weaker, so the UI says so instead of
  pretending otherwise.

Three demo documents (SSS_ID.pdf, PhilHealth_ID.png, Valid_ID.jpg) are seeded on
first load; "Add Doc" encrypts real files, and clicking a row decrypts it back
into a download.

## Brand assets

The supplied kit shipped as studio mockups (logo on white / black / grey), so
each asset was keyed to true transparency before use:

| File | Use |
| --- | --- |
| `egov-superagent-main.png` | landing hero (420px) |
| `egov-superagent-white.png` | `/app` sidebar (180px) |
| `egov-superagent-mark-white.png` | nav mark, chat avatar |
| `egov-superagent-icon.png` / `-icon-circle.png` | app icon / navy circular favicon |
| `egov-favicon-*.png`, `egov-favicon.ico` | favicons, declared in `src/app/(egov)/layout.tsx` |
| `source/*.png` | the original kit exports, unmodified apart from resizing |

Palette: Navy `#0A2156`, Action Blue `#1E90FF`, Yellow `#FCD116`, Red `#CE1126`,
canvas `#050A18` — exposed as Tailwind `egov-*` colours and as `BRAND` in
`src/lib/egov/brand.ts`.

## Scope

Everything on screen is mock data from `/mocks`. There is no SSS, PhilHealth,
Pag-IBIG or PSA integration, no Viber channel, and no blockchain. Messenger is
plumbed but not handled. This is a demonstration build and is not affiliated
with any Philippine government agency.
