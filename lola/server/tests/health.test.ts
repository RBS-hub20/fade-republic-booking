import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { buildHealth } from "../src/health.js";
import { createProviders } from "../src/adapters/factory.js";
import { loadConfig } from "../src/config/env.js";

describe("buildHealth", () => {
  it("reports ok with three providers and the Tagalog language profile", () => {
    const config = loadConfig();
    const providers = createProviders(config);
    const health = buildHealth(config, providers);

    expect(health.status).toBe("ok");
    expect(health.providers.map((p) => p.kind).sort()).toEqual(["llm", "stt", "tts"]);
    expect(health.language.target).toBe("tl");
    expect(health.language.registers).toContain("taglish");
    expect(() => new Date(health.time).toISOString()).not.toThrow();
  });

  it("reads provider mode from the live adapter, not config", () => {
    const config = loadConfig();
    const providers = createProviders(config);
    const health = buildHealth(config, providers);
    // Phase 1: every adapter is a stub regardless of config intent.
    expect(health.providers.every((p) => p.mode === "stub")).toBe(true);
  });
});

describe("app router", () => {
  it("serves /health", async () => {
    const app = createApp();
    const res = await app.handle("GET", "/health");
    expect(res.status).toBe(200);
  });

  it("serves /api/health (Vercel path) identically", async () => {
    const app = createApp();
    expect((await app.handle("GET", "/api/health")).status).toBe(200);
  });

  it("normalizes query strings and trailing slashes", async () => {
    const app = createApp();
    expect((await app.handle("GET", "/health/?foo=1")).status).toBe(200);
  });

  it("404s unknown routes", async () => {
    const app = createApp();
    expect((await app.handle("GET", "/nope")).status).toBe(404);
  });
});
