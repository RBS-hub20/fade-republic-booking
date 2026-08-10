/**
 * Tagalog grapheme → phoneme conversion.
 *
 * Tagalog orthography is famously close to one-letter-one-sound, which makes a
 * rule-based G2P both accurate enough and transparent. Phonemes are returned as
 * short string tokens (the digraph "ng" is a single token, "ŋ").
 *
 * This is intentionally a pronunciation MODEL, not a dictionary — good enough to
 * align two utterances and flag the sounds heritage learners actually trip on
 * (ng, the tapped r, pure vowels), and easy to extend.
 */

/** A handful of common irregulars where spelling ≠ sound. */
const LEXICON: Record<string, string[]> = {
  // "mga" (plural marker) is pronounced "manga".
  mga: ["m", "a", "ŋ", "a"],
  // "ng" (linker) is pronounced "nang".
  ng: ["n", "a", "ŋ"],
  // "ang" — the sound is /aŋ/.
  ang: ["a", "ŋ"],
};

/** Returns the flat phoneme sequence for a phrase. */
export function phonemize(text: string): string[] {
  const out: string[] = [];
  for (const word of tokenize(text)) {
    out.push(...phonemizeWord(word));
  }
  return out;
}

/** Returns phonemes grouped by word (useful for timing alignment later). */
export function phonemizeWords(text: string): { word: string; phonemes: string[] }[] {
  return tokenize(text).map((word) => ({ word, phonemes: phonemizeWord(word) }));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^a-zñ\s'’-]/g, " ") // keep letters, ñ, apostrophes, hyphens
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function phonemizeWord(word: string): string[] {
  const clean = word.replace(/['’-]/g, "");
  if (clean in LEXICON) return [...LEXICON[clean]!];

  const phonemes: string[] = [];
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    const next = clean[i + 1];

    // Digraph: ng → ŋ
    if (ch === "n" && next === "g") {
      phonemes.push("ŋ");
      i++;
      continue;
    }
    const mapped = mapChar(ch);
    if (mapped) phonemes.push(mapped);
  }
  return phonemes;
}

/** Map a single Tagalog grapheme to a phoneme token. */
function mapChar(ch: string): string | null {
  switch (ch) {
    // Vowels — kept pure (no English diphthongs).
    case "a":
      return "a";
    case "e":
      return "e";
    case "i":
      return "i";
    case "o":
      return "o";
    case "u":
      return "u";
    // Native consonants.
    case "b":
    case "d":
    case "g":
    case "h":
    case "k":
    case "l":
    case "m":
    case "n":
    case "p":
    case "r":
    case "s":
    case "t":
    case "w":
    case "y":
      return ch;
    case "ñ":
      return "ny";
    // Spanish/English loans → nearest Tagalog sound.
    case "c":
      return "k";
    case "q":
      return "k";
    case "v":
      return "b";
    case "f":
      return "p";
    case "z":
      return "s";
    case "j":
      return "h";
    case "x":
      return "ks";
    default:
      return null;
  }
}

export const VOWELS = new Set(["a", "e", "i", "o", "u"]);
