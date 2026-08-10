/**
 * Needleman–Wunsch alignment over two phoneme sequences (target vs heard).
 * Produces an ordered edit script we can turn into per-phoneme scores.
 */

export type AlignOp =
  | { type: "match"; target: string; heard: string }
  | { type: "sub"; target: string; heard: string }
  | { type: "del"; target: string } // target phoneme dropped (not heard)
  | { type: "ins"; heard: string }; // extra phoneme heard (not in target)

const GAP = 1;
const MISMATCH = 1;

export function alignPhonemes(target: string[], heard: string[]): AlignOp[] {
  const n = target.length;
  const m = heard.length;

  // dp[i][j] = min cost to align target[..i] with heard[..j]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i]![0] = i * GAP;
  for (let j = 0; j <= m; j++) dp[0]![j] = j * GAP;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = target[i - 1] === heard[j - 1] ? 0 : MISMATCH;
      dp[i]![j] = Math.min(
        dp[i - 1]![j - 1]! + cost, // match/sub
        dp[i - 1]![j]! + GAP, // del
        dp[i]![j - 1]! + GAP, // ins
      );
    }
  }

  // Backtrack.
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const t = target[i - 1];
    const h = heard[j - 1];
    if (i > 0 && j > 0) {
      const cost = t === h ? 0 : MISMATCH;
      if (dp[i]![j]! === dp[i - 1]![j - 1]! + cost) {
        ops.push(cost === 0 ? { type: "match", target: t!, heard: h! } : { type: "sub", target: t!, heard: h! });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i]![j]! === dp[i - 1]![j]! + GAP) {
      ops.push({ type: "del", target: t! });
      i--;
      continue;
    }
    ops.push({ type: "ins", heard: h! });
    j--;
  }
  ops.reverse();
  return ops;
}
