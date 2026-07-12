/**
 * Password policy + strength — pure and client-safe (no node crypto), so the
 * change-password form's strength meter and the API validation share one rule
 * set. Policy: 8+ chars, at least one uppercase, one number, one special char.
 */
export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
}

export const PASSWORD_RULE_LABELS: { key: keyof PasswordChecks; label: string }[] = [
  { key: "length", label: "At least 8 characters" },
  { key: "uppercase", label: "One uppercase letter" },
  { key: "number", label: "One number" },
  { key: "special", label: "One special character" },
];

export function checkPassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

/** True when the password satisfies every rule. */
export function passwordMeetsPolicy(pw: string): boolean {
  const c = checkPassword(pw);
  return c.length && c.uppercase && c.number && c.special;
}

/** 0–4 rules-satisfied score for the strength meter. */
export function passwordScore(pw: string): number {
  const c = checkPassword(pw);
  return [c.length, c.uppercase, c.number, c.special].filter(Boolean).length;
}

/** Human label + tone for a given score. */
export function passwordStrength(pw: string): { score: number; label: string; tone: "loss" | "gold" | "profit" } {
  const score = passwordScore(pw);
  if (pw.length === 0) return { score: 0, label: "", tone: "loss" };
  if (score <= 2) return { score, label: "Weak", tone: "loss" };
  if (score === 3) return { score, label: "Fair", tone: "gold" };
  return { score, label: "Strong", tone: "profit" };
}
