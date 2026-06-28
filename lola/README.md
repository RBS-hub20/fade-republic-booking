# Lola 🕯️

**Get speaking it with your family.**

Lola is a mobile-first conversation tutor for **heritage / diaspora learners**.
Where scripted drill apps teach you *about* a language, Lola gets you *speaking
it* — real, unscripted spoken practice with live pronunciation feedback.

- **MVP language:** Tagalog, including conversational **Taglish** and the formal
  `po/opo` register.
- **Base language:** English (used only to unblock, never to replace).

> This is the build repo. Development proceeds in phases; see
> [Build phases](#build-phases). **Phase 1 (foundation) is implemented.**

---

## What's here (Phase 1)

```
lola/
├── packages/shared/        Provider-adapter interfaces + shared DTOs (TS)
├── server/                 Orchestration layer
│   ├── src/adapters/       LLM / STT / TTS adapters (stub impls) + factory
│   ├── src/config/env.ts   Secrets + per-provider mode (stub vs live)
│   ├── src/app.ts          Transport-agnostic router (health)
│   ├── src/dev-server.ts   Local Node http server
│   ├── api/health.ts       Vercel serverless function
│   └── tests/              Adapter + health tests (vitest)
└── apps/mobile/            Expo (React Native) app — themed health screen
```

The three provider interfaces — `LLMProvider`, `STTProvider`, `TTSProvider` —
each have one **stub** implementation that returns well-typed fake data. No
vendor SDK is called anywhere yet. Secrets are read server-side only; the client
never holds a key.

---

## The conversation loop (Phase 2)

Type a message → the tutor replies in Tagalog **and** returns a structured coaching
block → the client renders them as two separate surfaces.

| Endpoint | Purpose |
| -------- | ------- |
| `POST /sessions` | Start a session (optional `{ scenario, level, baseLanguage }`) |
| `GET /sessions/:id` | Fetch the full transcript (resume) |
| `POST /sessions/:id/messages` | Send `{ text }` → `{ reply, coaching, level, utterance }` |
| `POST /sessions/:id/voice` | Full spoken turn: `{ audioBase64, mimeType }` → transcript + reply + reply audio |
| `POST /speech/tts` | Speak arbitrary text `{ text }` → `{ audioBase64 }` (e.g. replay a phrase) |
| `GET /prompts/tutor` | List prompt versions + the active one |
| `POST /prompts/tutor/versions` | Create + activate a new prompt version `{ content, notes }` |
| `POST /prompts/tutor/active` | Switch the active version `{ id }` |

- **Conversation engine** (`server/src/conversation/`) renders the active system
  prompt with the live scenario + learner state, calls Claude (`claude-sonnet-4-6`),
  splits the reply from the coaching, and **adapts the learner's level every turn**.
- **Authorable, versioned prompt** lives in `server/prompts/tutor/` (`vN.md` +
  `manifest.json`), read fresh per request — edit a file or POST a new version and the
  next turn uses it, **no redeploy**. This is where most product quality lives.
- **Coaching JSON** is delimited by a sentinel and parsed defensively: malformed or
  missing coaching degrades to "show just the reply" and never crashes the turn
  (see `coaching.ts` + its tests).
- **Persistence** is swappable behind `SessionStore`: a local file store (dev default,
  zero credentials) or Supabase Postgres (`store/schema.sql`) when configured.

## Pronunciation scoring (Phase 4)

On a voice turn, the learner's utterance is scored against a target (an explicit
"repeat after me" target, else the native form from the tutor's correction, else
the transcript itself). The scorer (`server/src/pronunciation/`):

1. **Tagalog G2P** (`g2p.ts`) — rule-based grapheme→phoneme (Tagalog is near
   one-letter-one-sound), with the `ng` digraph as a single phoneme and a few
   irregulars (`mga` → "manga").
2. **Phoneme alignment** (`align.ts`) — Needleman–Wunsch edit script between the
   target and heard phoneme sequences.
3. **Scoring** (`scorer.ts`) — grades each target phoneme `good / shaky / off /
   missed / extra` and emits **specific** advice ("your *ng* is landing too hard,"
   not a bare number). Low STT confidence softens matches to `shaky`.

Per-phoneme accuracy accumulates on the learner (`weak-spots.ts`); the worst
sounds are resurfaced into the tutor prompt's `{{weakSpots}}` so the tutor
reinforces them naturally, and shown in the app as a pronunciation card +
"working on" chip.

```bash
# Try the loop on stubs (no API key needed):
SID=$(curl -s -X POST localhost:4000/sessions -d '{}' -H 'content-type: application/json' \
  | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).session.id))')
curl -s -X POST localhost:4000/sessions/$SID/messages \
  -H 'content-type: application/json' -d '{"text":"Kumusta po kayo, Lola?"}'
```

Set `LOLA_LIVE_PROVIDERS=1` + `ANTHROPIC_API_KEY` to run the real tutor.

## Architecture

```
[ Expo / RN client ]  ──audio in / reply + feedback out──►  [ Server ]
                                                              ├─ ConversationService → LLMProvider  (Claude)
                                                              ├─ SpeechService       → STTProvider  (Whisper)
                                                              ├─ VoiceService        → TTSProvider  (ElevenLabs)
                                                              ├─ PronunciationScorer  (Phase 4)
                                                              └─ ProgressStore        (Supabase)
```

- **All LLM/STT/TTS calls go through the server**, never the device.
- Providers sit behind interfaces in `@lola/shared`; swapping a vendor means
  writing one adapter, with **no app-logic changes**.
- Health reports each adapter's *real* mode, so a silent downgrade is visible.

### Chosen stack

| Concern        | Choice                              |
| -------------- | ----------------------------------- |
| Client         | Expo / React Native (iOS + Android) |
| API + hosting  | Vercel serverless functions         |
| Database       | Supabase (Postgres + auth) — wired in Phase 2 |
| Conversation   | Anthropic Claude (`claude-sonnet-4-6`) |
| Speech-to-text | OpenAI Whisper                      |
| Text-to-speech | ElevenLabs (multilingual)           |

---

## Setup

Requires Node ≥ 18.18.

```bash
cd lola
cp .env.example .env        # fill keys later; Phase 1 runs fully on stubs
npm install                 # installs root workspaces (shared + server)
```

### Run the server

```bash
npm run dev:server          # http://localhost:4000
curl http://localhost:4000/health
```

You should see `status: "ok"` and three providers in `stub` mode.

### Run the tests

```bash
npm test                    # vitest: adapters + health
```

### Run the mobile app

The Expo app is a standalone package (kept out of the root workspace so Metro
stays simple):

```bash
cd apps/mobile
npm install
# point the app at your server (LAN IP on a physical device):
EXPO_PUBLIC_API_URL=http://localhost:4000 npm run start
```

---

## Environment variables

| Var                   | Where  | Purpose                                            |
| --------------------- | ------ | -------------------------------------------------- |
| `PORT`                | server | Local dev server port (default 4000)               |
| `LOLA_LIVE_PROVIDERS` | server | `1` enables live adapters (Phase 2+). Default off. |
| `ANTHROPIC_API_KEY`   | server | Claude conversation engine                         |
| `LOLA_LLM_MODEL`      | server | Override model (default `claude-sonnet-4-6`)       |
| `OPENAI_API_KEY`      | server | Whisper STT                                        |
| `ELEVENLABS_API_KEY`  | server | ElevenLabs TTS                                     |
| `LOLA_TTS_VOICE_ID`   | server | Default Tagalog/multilingual voice                 |
| `SUPABASE_URL`        | server | Supabase project URL (enables Postgres persistence) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Service-role key — server-side only          |
| `EXPO_PUBLIC_API_URL` | mobile | Server base URL (public; never a secret)           |

Secrets live **only** on the server. `.env` is git-ignored.

---

## Swapping a provider

1. Implement the relevant interface from `@lola/shared`
   (`LLMProvider` / `STTProvider` / `TTSProvider`) in a new file under
   `server/src/adapters/<kind>/`.
2. Add a branch for it in `server/src/adapters/factory.ts`.
3. Add its key to `env.ts` and `.env.example`.

Nothing else in the app references a vendor.

---

## Build phases

- [x] **Phase 1 — Foundation.** Scaffold, env/secrets, adapter interfaces + one
      stub each, health check. Runnable, no real calls.
- [x] **Phase 2 — Conversation loop (text).** Real Claude adapter, versioned/authorable
      tutor prompt, structured coaching JSON (parsed safely), persisted transcripts,
      mobile conversation screen.
- [x] **Phase 3 — Voice in/out.** Real Whisper STT (word-level timings) + ElevenLabs TTS
      behind the adapters, a one-call spoken-turn endpoint, and a mobile record/playback
      UI with listening / thinking / speaking states (reduced-motion aware).
- [x] **Phase 4 — Pronunciation scoring.** Tagalog G2P → phoneme alignment → per-phoneme
      feedback with specific tips; weak phonemes persisted per learner and resurfaced into
      the tutor prompt; mobile pronunciation card + "working on" chip.
- [ ] Phase 5 — Scenarios + "Talk to your family" prep mode.
- [ ] Phase 6 — ICP onboarding + conversation/phoneme progress.

## Data & privacy

Audio and transcripts are sent only to the chosen providers (Whisper, ElevenLabs,
Claude) for processing and stored in our own Supabase. We do not log raw audio or
transcripts to any other third party.
