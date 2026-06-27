import { randomUUID } from "node:crypto";
import type {
  CreateSessionRequest,
  ProviderSet,
  Scenario,
  SendMessageRequest,
  Session,
} from "@lola/shared";
import { loadConfig, type AppConfig } from "./config/env.js";
import { createProviders } from "./adapters/factory.js";
import { buildHealth } from "./health.js";
import { PromptStore } from "./conversation/prompt-store.js";
import { ConversationService } from "./conversation/conversation-service.js";
import { DEFAULT_SCENARIO } from "./conversation/scenarios.js";
import { createSessionStore } from "./store/factory.js";
import type { SessionStore } from "./store/session-store.js";

/**
 * App composition root. Builds config, providers, prompt store, session store,
 * and the conversation engine once, then exposes a transport-agnostic async
 * router shared by the dev server and the Vercel handler.
 */
export interface App {
  config: AppConfig;
  providers: ProviderSet;
  store: SessionStore;
  handle(method: string, path: string, body?: unknown): Promise<RouteResult>;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

export function createApp(): App {
  const config = loadConfig();
  const providers = createProviders(config);
  const prompts = new PromptStore(config.paths.promptsDir);
  const store = createSessionStore(config);
  const conversation = new ConversationService(providers.llm, prompts, config.language);

  async function route(
    method: string,
    path: string,
    body: unknown,
  ): Promise<RouteResult> {
    const m = method.toUpperCase();
    const segments = normalize(path).split("/").filter(Boolean);
    const p = "/" + segments.join("/");

    // Static routes
    if (m === "GET" && (p === "/" || p === "")) {
      return ok({
        service: config.service,
        version: config.version,
        tagline: "Get speaking it with your family.",
        routes: [
          "GET /health",
          "POST /sessions",
          "GET /sessions/:id",
          "POST /sessions/:id/messages",
          "GET /prompts/tutor",
          "POST /prompts/tutor/versions",
          "POST /prompts/tutor/active",
        ],
      });
    }
    if (m === "GET" && (p === "/health" || p === "/api/health")) {
      return ok(buildHealth(config, providers));
    }

    // Sessions
    if (m === "POST" && p === "/sessions") {
      const session = createSession((body ?? {}) as CreateSessionRequest);
      await store.upsert(session);
      return { status: 201, body: { session } };
    }
    if (m === "GET" && segments[0] === "sessions" && segments.length === 2) {
      const session = await store.get(segments[1]!);
      if (!session) return notFound("session", segments[1]!);
      return ok({ session });
    }
    if (
      m === "POST" &&
      segments[0] === "sessions" &&
      segments[2] === "messages" &&
      segments.length === 3
    ) {
      const session = await store.get(segments[1]!);
      if (!session) return notFound("session", segments[1]!);
      const text = (body as SendMessageRequest | undefined)?.text?.trim();
      if (!text) {
        return { status: 400, body: { error: "bad_request", message: "`text` is required" } };
      }
      const result = await conversation.sendLearnerMessage(session, text);
      await store.upsert(session);
      return ok(result);
    }

    // Prompt authoring (versioned, no redeploy)
    if (m === "GET" && p === "/prompts/tutor") {
      return ok(prompts.list());
    }
    if (m === "POST" && p === "/prompts/tutor/versions") {
      const { content, notes } = (body ?? {}) as { content?: string; notes?: string };
      if (!content || content.trim().length === 0) {
        return { status: 400, body: { error: "bad_request", message: "`content` is required" } };
      }
      const meta = prompts.createVersion(content, notes ?? "");
      return { status: 201, body: { version: meta } };
    }
    if (m === "POST" && p === "/prompts/tutor/active") {
      const { id } = (body ?? {}) as { id?: string };
      if (!id) {
        return { status: 400, body: { error: "bad_request", message: "`id` is required" } };
      }
      prompts.setActive(id);
      return ok(prompts.list());
    }

    return { status: 404, body: { error: "not_found", message: `No route for ${m} ${p}` } };
  }

  async function handle(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<RouteResult> {
    try {
      return await route(method, path, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[lola] request failed:", message);
      return { status: 500, body: { error: "internal_error", message } };
    }
  }

  function createSession(req: CreateSessionRequest): Session {
    const now = new Date().toISOString();
    const scenario: Scenario = {
      ...DEFAULT_SCENARIO,
      ...(req.scenario ?? {}),
      id: req.scenario?.id ?? DEFAULT_SCENARIO.id,
    };
    return {
      id: randomUUID(),
      scenario,
      learnerState: {
        level: req.level ?? "building",
        baseLanguage: req.baseLanguage ?? config.language.base,
        weakSpots: [],
      },
      utterances: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  return { config, providers, store, handle };
}

function ok(body: unknown): RouteResult {
  return { status: 200, body };
}

function notFound(kind: string, id: string): RouteResult {
  return { status: 404, body: { error: "not_found", message: `No ${kind} with id ${id}` } };
}

/** Strip query string and trailing slash (except root). */
function normalize(path: string): string {
  const noQuery = path.split("?")[0] ?? "/";
  if (noQuery.length > 1 && noQuery.endsWith("/")) return noQuery.slice(0, -1);
  return noQuery || "/";
}
