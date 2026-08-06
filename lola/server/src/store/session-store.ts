import type { ProviderMode, Session } from "@lola/shared";

/**
 * Persistence for sessions + their transcripts, so a conversation can be
 * resumed. Sits behind an interface like the provider adapters — swap the
 * backend without touching conversation logic.
 */
export interface SessionStore {
  readonly name: string;
  readonly mode: ProviderMode;
  get(id: string): Promise<Session | null>;
  /** Insert or update a session (full document). */
  upsert(session: Session): Promise<void>;
}
