import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Session } from "@lola/shared";
import type { SessionStore } from "./session-store.js";

/**
 * Default persistent store: one JSON file per session on local disk. Survives
 * server restarts, needs no external service, and lets the whole loop run with
 * zero credentials. Production uses the Supabase store instead.
 */
export class FileSessionStore implements SessionStore {
  readonly name = "file";
  readonly mode = "live" as const;

  constructor(private readonly dir: string) {
    mkdirSync(this.dir, { recursive: true });
  }

  private path(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  async get(id: string): Promise<Session | null> {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return null; // guard path traversal
    const p = this.path(id);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as Session;
  }

  async upsert(session: Session): Promise<void> {
    writeFileSync(this.path(session.id), JSON.stringify(session, null, 2), "utf8");
  }
}
