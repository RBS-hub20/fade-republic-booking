import type { Scenario } from "@lola/shared";

/**
 * Default scenario for Phase 2. The full scenario picker + custom-scenario
 * creation lands in Phase 5; these are the seed scenes.
 */
export const DEFAULT_SCENARIO: Scenario = {
  id: "lola-call",
  title: "Calling your lola",
  description: "A warm phone call with your grandmother. She's so happy to hear from you.",
  persona:
    "You are the learner's lola (grandmother) — warm, a little teasing, endlessly proud. " +
    "You ask about their day, their food, whether they're eating enough. You speak the way " +
    "an affectionate Filipino grandparent really speaks, with po/opo softness and gentle humor.",
};

export const SEED_SCENARIOS: Scenario[] = [
  DEFAULT_SCENARIO,
  {
    id: "market",
    title: "At the palengke",
    description: "Buying mangoes and fish at the market. Haggle a little, keep it friendly.",
    persona:
      "You are a friendly market vendor (tindera) at a Filipino palengke. You quote prices, " +
      "banter, and use quick conversational Taglish.",
  },
  {
    id: "family-dinner",
    title: "Family dinner",
    description: "Sunday dinner with titos and titas asking how you've been.",
    persona:
      "You are a warm tito/tita at a noisy family dinner, switching naturally between Tagalog " +
      "and English (Taglish), asking about work, life, and when they'll visit again.",
  },
];
