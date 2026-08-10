-- Lola — Supabase / Postgres schema (Phase 2: sessions + transcripts).
-- Run in the Supabase SQL editor. The server uses the service-role key, so RLS
-- is enabled with no public policies: only the server (which bypasses RLS) reads
-- and writes. Add per-user policies in a later phase when auth lands.

create table if not exists public.sessions (
  id            text primary key,
  scenario      jsonb       not null,
  learner_state jsonb       not null,
  utterances    jsonb       not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists sessions_updated_at_idx
  on public.sessions (updated_at desc);

alter table public.sessions enable row level security;
-- No policies → anon/auth clients get nothing; the service-role key bypasses RLS.
