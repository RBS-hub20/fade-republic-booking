import { createServer, type IncomingMessage } from "node:http";
import { createApp } from "./app.js";

/**
 * Local dev server (Node built-in http; no framework deps). Reads JSON bodies
 * and mirrors the Vercel handler via the shared async app router.
 */
const app = createApp();

const server = createServer(async (req, res) => {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    res.writeHead(400, jsonHeaders());
    res.end(JSON.stringify({ error: "bad_request", message: "Invalid JSON body" }));
    return;
  }

  const result = await app.handle(req.method ?? "GET", req.url ?? "/", body);
  res.writeHead(result.status, jsonHeaders());
  res.end(JSON.stringify(result.body, null, 2));
});

server.listen(app.config.port, () => {
  const { llm, stt, tts } = app.providers;
  console.log(`[lola] server listening on http://localhost:${app.config.port}`);
  console.log(`[lola] health:   http://localhost:${app.config.port}/health`);
  console.log(
    `[lola] providers — llm:${llm.name}(${llm.mode}) ` +
      `stt:${stt.name}(${stt.mode}) tts:${tts.name}(${tts.mode}) ` +
      `store:${app.store.name}`,
  );
});

function jsonHeaders(): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
}
