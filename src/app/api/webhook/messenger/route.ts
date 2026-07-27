import { NextResponse } from "next/server";

/**
 * Messenger webhook — plumbing only.
 *
 * The MVP ships the endpoint so a Facebook page can be pointed at it during a
 * demo, but nothing is dispatched to the agent yet: POST logs the payload and
 * acknowledges. Messenger requires an ack inside 20s or it retries, so this
 * always returns 200 even when the body is unparseable.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = await req.text().catch(() => null);
  }

  console.log("[messenger-webhook]", JSON.stringify({ receivedAt: new Date().toISOString(), body }));

  return NextResponse.json({ ok: true });
}

/**
 * Verification handshake. Facebook calls GET with hub.challenge when the
 * webhook URL is first registered; echoing it back is what completes setup.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.MESSENGER_VERIFY_TOKEN;

  if (mode === "subscribe" && challenge && expected && token === expected) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }

  // No handshake in flight — report readiness so the route is easy to smoke-test.
  return NextResponse.json({ ok: true, service: "messenger-webhook", status: "ready" });
}
