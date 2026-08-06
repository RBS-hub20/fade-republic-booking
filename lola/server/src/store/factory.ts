import { join } from "node:path";
import type { AppConfig } from "../config/env.js";
import type { SessionStore } from "./session-store.js";
import { FileSessionStore } from "./file-session-store.js";
import { SupabaseSessionStore } from "./supabase-session-store.js";

/**
 * Selects the session backend: Supabase when configured (production), otherwise
 * a local file store so the whole loop runs with zero credentials.
 */
export function createSessionStore(config: AppConfig): SessionStore {
  if (config.supabase) {
    return new SupabaseSessionStore(config.supabase.url, config.supabase.serviceKey);
  }
  return new FileSessionStore(join(config.paths.dataDir, "sessions"));
}
