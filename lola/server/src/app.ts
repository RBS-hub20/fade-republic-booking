import type { ProviderSet } from "@lola/shared";
import { loadConfig, type AppConfig } from "./config/env.js";
import { createProviders } from "./adapters/factory.js";
import { buildHealth } from "./health.js";

/**
 * App composition root. Builds config + providers once and exposes a
 * transport-agnostic router so the local dev server and the Vercel serverless
 * handler share exactly the same logic.
 */
export interface App {
  config: AppConfig;
  providers: ProviderSet;
  handle(method: string, path: string): RouteResult;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

export function createApp(): App {
  const config = loadConfig();
  const providers = createProviders(config);

  function handle(method: string, path: string): RouteResult {
    const route = `${method.toUpperCase()} ${normalize(path)}`;

    switch (route) {
      case "GET /":
        return {
          status: 200,
          body: {
            service: config.service,
            version: config.version,
            tagline: "Get speaking it with your family.",
            routes: ["/health"],
          },
        };

      case "GET /health":
      case "GET /api/health":
        return { status: 200, body: buildHealth(config, providers) };

      default:
        return {
          status: 404,
          body: { error: "not_found", message: `No route for ${route}` },
        };
    }
  }

  return { config, providers, handle };
}

/** Strip query string and trailing slash (except root). */
function normalize(path: string): string {
  const noQuery = path.split("?")[0] ?? "/";
  if (noQuery.length > 1 && noQuery.endsWith("/")) return noQuery.slice(0, -1);
  return noQuery || "/";
}
