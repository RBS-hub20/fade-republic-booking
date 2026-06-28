import { describe, expect, it } from "vitest";
import { phonemize } from "../src/pronunciation/g2p.js";
import { alignPhonemes } from "../src/pronunciation/align.js";
import { PronunciationScorer } from "../src/pronunciation/scorer.js";
import { deriveWeakSpots, updatePhonemeStats } from "../src/pronunciation/weak-spots.js";

describe("Tagalog G2P", () => {
  it("treats ng as a single phoneme", () => {
    expect(phonemize("ngayon")).toEqual(["ŋ", "a", "y", "o", "n"]);
  });

  it("handles the 'mga' irregular (pronounced 'manga')", () => {
    expect(phonemize("mga")).toEqual(["m", "a", "ŋ", "a"]);
  });

  it("maps loan letters to nearest Tagalog sounds", () => {
    expect(phonemize("cafe")).toEqual(["k", "a", "p", "e"]); // c→k, f→p
  });
});

describe("alignPhonemes", () => {
  it("matches identical sequences", () => {
    const ops = alignPhonemes(["a", "b"], ["a", "b"]);
    expect(ops.every((o) => o.type === "match")).toBe(true);
  });

  it("detects a substitution", () => {
    const ops = alignPhonemes(["r"], ["d"]);
    expect(ops).toEqual([{ type: "sub", target: "r", heard: "d" }]);
  });

  it("detects a dropped (deleted) target phoneme", () => {
    const ops = alignPhonemes(["ŋ", "a"], ["a"]);
    expect(ops[0]).toEqual({ type: "del", target: "ŋ" });
  });
});

describe("PronunciationScorer", () => {
  const scorer = new PronunciationScorer();

  it("gives a perfect score and no weak spots when target == heard", () => {
    const r = scorer.score({ target: "Kumusta po", heard: "Kumusta po", confidence: 0.95 });
    expect(r.overall).toBe(1);
    expect(r.weakPhonemes).toEqual([]);
    expect(r.phonemes.every((p) => p.status === "good")).toBe(true);
  });

  it("flags the dropped ng with a specific, named tip", () => {
    const r = scorer.score({ target: "ngiti", heard: "iti", confidence: 0.95 });
    expect(r.weakPhonemes).toContain("ng");
    const ng = r.phonemes.find((p) => p.phoneme === "ng");
    expect(ng?.status).toBe("missed");
    expect(ng?.note).toMatch(/ng/i);
    expect(r.overall).toBeLessThan(1);
    expect(r.tips.length).toBeGreaterThan(0);
  });

  it("softens matches to 'shaky' under low STT confidence", () => {
    const r = scorer.score({ target: "oo", heard: "oo", confidence: 0.4 });
    expect(r.phonemes.every((p) => p.status === "shaky")).toBe(true);
    expect(r.weakPhonemes).toContain("o");
  });

  it("labels ng readably (not the raw token)", () => {
    const r = scorer.score({ target: "ang", heard: "ang", confidence: 0.95 });
    expect(r.phonemes.map((p) => p.phoneme)).toContain("ng");
    expect(r.phonemes.map((p) => p.phoneme)).not.toContain("ŋ");
  });
});

describe("weak-spot tracking", () => {
  it("accumulates attempts/errors and resurfaces persistent weak phonemes", () => {
    const scorer = new PronunciationScorer();
    let stats = updatePhonemeStats(undefined, scorer.score({ target: "ngiti", heard: "iti" }));
    stats = updatePhonemeStats(stats, scorer.score({ target: "ngayon", heard: "ayon" }));

    // ng dropped twice → should surface; vowels were fine → should not
    expect(stats["ng"]!.attempts).toBe(2);
    expect(stats["ng"]!.errors).toBe(2);
    const weak = deriveWeakSpots(stats);
    expect(weak).toContain("ng");
    expect(weak).not.toContain("a");
  });

  it("requires a real error rate before resurfacing", () => {
    const scorer = new PronunciationScorer();
    // One clean turn → no weak spots despite attempts
    const stats = updatePhonemeStats(undefined, scorer.score({ target: "mabuti", heard: "mabuti" }));
    expect(deriveWeakSpots(stats)).toEqual([]);
  });
});
