import type { HealthResponse } from "../types";

/**
 * Thin API client. The app ONLY ever talks to our server — never to a vendor
 * directly, and it never holds an API key. The base URL is public config.
 */
const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

export const apiBaseUrl = API_URL;

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`, { signal });
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return (await res.json()) as HealthResponse;
}
