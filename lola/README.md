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
- [ ] Phase 2 — Conversation loop (text, real Claude) + versioned system prompt.
- [ ] Phase 3 — Voice in/out (Whisper + ElevenLabs).
- [ ] Phase 4 — Pronunciation scoring + weak-phoneme tracking.
- [ ] Phase 5 — Scenarios + "Talk to your family" prep mode.
- [ ] Phase 6 — ICP onboarding + conversation/phoneme progress.

## Data & privacy

Audio and transcripts are sent only to the chosen providers (Whisper, ElevenLabs,
Claude) for processing and stored in our own Supabase. We do not log raw audio or
transcripts to any other third party.
