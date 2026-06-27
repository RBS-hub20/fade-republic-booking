import { createServer } from "node:http";
import { createApp } from "./app.js";

/**
 * Local dev server (Node built-in http; no framework deps in Phase 1).
 * Mirrors the Vercel handler behaviour via the shared app router.
 */
const app = createApp();

const server = createServer((req, res) => {
  const result = app.handle(req.method ?? "GET", req.url ?? "/");
  res.writeHead(result.status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(result.body, null, 2));
});

server.listen(app.config.port, () => {
  const { llm, stt, tts } = app.providers;
  console.log(`[lola] server listening on http://localhost:${app.config.port}`);
  console.log(`[lola] health:   http://localhost:${app.config.port}/health`);
  console.log(
    `[lola] providers — llm:${llm.name}(${llm.mode}) ` +
      `stt:${stt.name}(${stt.mode}) tts:${tts.name}(${tts.mode})`,
  );
});
