import { PAIR_B_SCORE_WINDOW, PAIR_EPSILON, PAIR_MIN_POOL } from "@/lib/constants";

const NOT_FOUND = -1;
const TIMES_SHOWN_FLOOR = 1; // +1 so timesShown=0 does not divide by zero

export type Candidate = {
  id: string;
  rating: number;
  rd: number;
  score: number;
  timesShown: number;
};

export type PickPairCoreInput = {
  aPool: Candidate[]; // candidates for A, drawn via (status, rd) index
  bPool: Candidate[]; // candidates for B, drawn via (status, score) index
  seenCatIds: string[]; // ids to exclude from B
  rng: () => number; // injected RNG in [0, 1) for deterministic tests
};

export type PickedPairCore = {
  a: Candidate;
  b: Candidate;
};

export { pickPairCore, selectWeightedIndex, weightForA };

/** Selection weight for A: favors high rd and low timesShown. weight = rd / sqrt(timesShown + 1). */
function weightForA(candidate: Candidate): number {
  return candidate.rd / Math.sqrt(candidate.timesShown + TIMES_SHOWN_FLOOR);
}

/** Pick an index proportional to weights using one rng draw. Returns -1 for empty input. */
function selectWeightedIndex(weights: number[], rng: () => number): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return NOT_FOUND;
  }
  let target = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    const w = weights[i] ?? 0;
    target -= w;
    if (target < 0) {
      return i;
    }
  }
  return weights.length - 1;
}

/** Pure pair selection. Returns null when no valid pair can be formed. */
function pickPairCore(input: PickPairCoreInput): PickedPairCore | null {
  const { aPool, bPool, seenCatIds, rng } = input;

  if (aPool.length === 0) {
    return null;
  }

  const aIndex = selectWeightedIndex(aPool.map(weightForA), rng);
  if (aIndex === NOT_FOUND) {
    return null;
  }
  const a = aPool[aIndex];
  if (!a) {
    return null;
  }

  const seen = new Set(seenCatIds);
  // Eligible opponents: exclude A itself and recently-seen cats, nearest score first.
  const eligibleB = bPool
    .filter((c) => c.id !== a.id && !seen.has(c.id))
    .sort((x, y) => Math.abs(x.score - a.score) - Math.abs(y.score - a.score));

  if (eligibleB.length === 0 || aPool.length + eligibleB.length < PAIR_MIN_POOL) {
    return null;
  }

  // Prefer an opponent within the score window for a close matchup; if none qualify
  // (small or score-diverged pool), fall back to the closest eligible cat so a pair
  // is always formed when at least two eligible cats exist. The window is a quality
  // preference, not a hard requirement — without this the duel 404s once scores spread.
  const withinWindow = eligibleB.filter((c) => Math.abs(c.score - a.score) <= PAIR_B_SCORE_WINDOW);
  const pool = withinWindow.length > 0 ? withinWindow : eligibleB;

  const closest = pool[0]; // sorted ascending by score distance: nearest first
  if (!closest) {
    return null;
  }

  const rollEpsilon = rng() < PAIR_EPSILON;
  let b: Candidate = closest;
  if (rollEpsilon && pool.length > 1) {
    const randomIndex = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    b = pool[randomIndex] ?? closest;
  }

  return { a, b };
}
