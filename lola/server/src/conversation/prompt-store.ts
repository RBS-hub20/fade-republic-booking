import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PromptListResponse, PromptVersionMeta } from "@lola/shared";

/**
 * File-backed, versioned store for the tutor system prompt.
 *
 * This is where most of the product quality lives, so it is authorable and
 * versioned WITHOUT a redeploy: the manifest and prompt files are read fresh on
 * every request. Edit a file or flip `active` in the manifest and the next turn
 * uses it. New versions can also be created via the API.
 *
 * Layout:
 *   <dir>/manifest.json       { active, versions: [{id,label,notes,createdAt}] }
 *   <dir>/<id>.md             one prompt template per version
 */
interface ManifestVersion {
  id: string;
  label: string;
  notes: string;
  createdAt: string;
}
interface Manifest {
  active: string;
  versions: ManifestVersion[];
}

export class PromptStore {
  constructor(private readonly dir: string) {
    mkdirSync(this.dir, { recursive: true });
  }

  private manifestPath(): string {
    return join(this.dir, "manifest.json");
  }

  private contentPath(id: string): string {
    return join(this.dir, `${id}.md`);
  }

  private readManifest(): Manifest {
    const path = this.manifestPath();
    if (!existsSync(path)) {
      throw new Error(
        `[lola] No tutor prompt manifest at ${path}. Did the prompts/ dir ship?`,
      );
    }
    return JSON.parse(readFileSync(path, "utf8")) as Manifest;
  }

  private writeManifest(manifest: Manifest): void {
    writeFileSync(this.manifestPath(), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  }

  /** The raw template text for the active version. */
  getActiveContent(): { id: string; content: string } {
    const manifest = this.readManifest();
    return { id: manifest.active, content: this.getContent(manifest.active) };
  }

  getContent(id: string): string {
    const path = this.contentPath(id);
    if (!existsSync(path)) {
      throw new Error(`[lola] Unknown prompt version "${id}" (${path} missing)`);
    }
    return readFileSync(path, "utf8");
  }

  list(): PromptListResponse {
    const manifest = this.readManifest();
    const versions: PromptVersionMeta[] = manifest.versions.map((v) => ({
      ...v,
      active: v.id === manifest.active,
    }));
    return { active: manifest.active, versions };
  }

  setActive(id: string): void {
    const manifest = this.readManifest();
    if (!manifest.versions.some((v) => v.id === id)) {
      throw new Error(`[lola] Cannot activate unknown prompt version "${id}"`);
    }
    manifest.active = id;
    this.writeManifest(manifest);
  }

  /** Creates a new version, writes its file, and makes it active. */
  createVersion(content: string, notes: string): PromptVersionMeta {
    const manifest = this.readManifest();
    const id = nextVersionId(manifest.versions.map((v) => v.id));
    const meta: ManifestVersion = {
      id,
      label: notes.slice(0, 60) || id,
      notes,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(this.contentPath(id), content, "utf8");
    manifest.versions.push(meta);
    manifest.active = id;
    this.writeManifest(manifest);
    return { ...meta, active: true };
  }
}

function nextVersionId(existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    const m = /^v(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `v${max + 1}`;
}
