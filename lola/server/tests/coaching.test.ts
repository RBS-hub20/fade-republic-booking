import { describe, expect, it } from "vitest";
import { COACHING_SENTINEL, parseTutorMessage } from "../src/conversation/coaching.js";

function withCoaching(reply: string, json: string): string {
  return `${reply}\n${COACHING_SENTINEL}\n${json}`;
}

describe("parseTutorMessage", () => {
  it("splits reply from a valid coaching block", () => {
    const json = JSON.stringify({
      corrections: [{ original: "kumusta ka", better: "Kumusta ka po", note: "add po for an elder" }],
      pronunciation: "your ng is landing a little hard",
      register: "use po with lola",
      newPhrase: { phrase: "Mahal kita", meaning: "I love you" },
      level: "building",
      encouragement: "Ang galing mo!",
    });
    const { reply, coaching } = parseTutorMessage(withCoaching("Ay, kumusta ka, apo?", json));

    expect(reply).toBe("Ay, kumusta ka, apo?");
    expect(coaching).not.toBeNull();
    expect(coaching!.corrections).toHaveLength(1);
    expect(coaching!.corrections[0]!.note).toContain("po");
    expect(coaching!.level).toBe("building");
    expect(coaching!.newPhrase?.phrase).toBe("Mahal kita");
  });

  it("returns the whole text and null coaching when there is no sentinel", () => {
    const { reply, coaching } = parseTutorMessage("Mabuhay! Kumusta ka?");
    expect(reply).toBe("Mabuhay! Kumusta ka?");
    expect(coaching).toBeNull();
  });

  it("never crashes on malformed JSON — falls back to reply only", () => {
    const { reply, coaching } = parseTutorMessage(
      withCoaching("Salamat!", "{not valid json,,,"),
    );
    expect(reply).toBe("Salamat!");
    expect(coaching).toBeNull();
  });

  it("coerces missing/garbage fields to safe defaults", () => {
    const { coaching } = parseTutorMessage(
      withCoaching("Sige.", JSON.stringify({ corrections: "nope", level: "wizard" })),
    );
    expect(coaching).not.toBeNull();
    expect(coaching!.corrections).toEqual([]);
    expect(coaching!.level).toBe("building"); // invalid level → safe default
    expect(coaching!.pronunciation).toBeNull();
    expect(coaching!.newPhrase).toBeNull();
  });

  it("ignores junk after a non-object JSON value", () => {
    const { reply, coaching } = parseTutorMessage(withCoaching("Oo.", "42"));
    expect(reply).toBe("Oo.");
    expect(coaching).toBeNull();
  });

  it("uses the LAST sentinel if the reply happens to contain the marker text", () => {
    const json = JSON.stringify({ corrections: [], level: "fluent" });
    const raw = `Talking about ${COACHING_SENTINEL} markers\n${COACHING_SENTINEL}\n${json}`;
    const { reply, coaching } = parseTutorMessage(raw);
    expect(reply).toContain("Talking about");
    expect(coaching!.level).toBe("fluent");
  });
});
