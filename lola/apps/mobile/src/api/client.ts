import type {
  HealthResponse,
  LearnerLevel,
  Session,
  SendMessageResponse,
} from "../types";

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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function createSession(level?: LearnerLevel): Promise<Session> {
  const { session } = await post<{ session: Session }>("/sessions", level ? { level } : {});
  return session;
}

export async function sendMessage(
  sessionId: string,
  text: string,
): Promise<SendMessageResponse> {
  return post<SendMessageResponse>(`/sessions/${sessionId}/messages`, { text });
}
