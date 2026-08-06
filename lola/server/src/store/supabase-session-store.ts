import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@lola/shared";
import type { SessionStore } from "./session-store.js";

/**
 * Supabase (Postgres) session store — the production backend. Each session is a
 * row; the transcript lives in a jsonb column so resuming is a single read. See
 * `schema.sql` for the table. Uses the service-role key, so it MUST only ever
 * run server-side.
 */
export class SupabaseSessionStore implements SessionStore {
  readonly name = "supabase";
  readonly mode = "live" as const;
  private readonly client: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }

  async get(id: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from("sessions")
      .select("id, scenario, learner_state, utterances, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`[lola] Supabase get failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      scenario: data.scenario,
      learnerState: data.learner_state,
      utterances: data.utterances ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async upsert(session: Session): Promise<void> {
    const { error } = await this.client.from("sessions").upsert(
      {
        id: session.id,
        scenario: session.scenario,
        learner_state: session.learnerState,
        utterances: session.utterances,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(`[lola] Supabase upsert failed: ${error.message}`);
  }
}
