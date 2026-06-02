// Entity limits (configurable defaults — may change later)
export const MAX_CATS_PER_USER = 2;
export const MAX_IMAGES_PER_CAT = 3;
export const MAX_ORGS_PER_USER = 1;
export const MAX_ORGS_PER_CAT = 2;

// Glicko-2 starting values (the rating entity is the Cat)
export const GLICKO_DEFAULT = {
  rating: 1500,
  rd: 350,
  vol: 0.06,
} as const;

// Conservative leaderboard score: lower bound of 95% CI.
// score = rating - 2 * rd  (denormalized into Cat.score / CatOrg.score)
export const SCORE = (rating: number, rd: number): number => rating - 2 * rd;

// Image processing sizes (max edge, px) — sharp → WebP
export const IMAGE_SIZE = {
  THUMB: 200,
  CARD: 800,
} as const;

// Pairing — candidate pools & selection windows
export const PAIR_A_CANDIDATE_POOL = 40; // rows pulled via (status, rd) index for A
export const PAIR_B_CANDIDATE_POOL = 40; // rows pulled via (status, score) index for B
export const PAIR_B_SCORE_WINDOW = 120; // B.score must be within ±window of A.score
export const PAIR_EPSILON = 0.15; // prob. of picking a random eligible B instead of the closest
export const PAIR_MIN_POOL = 2; // need ≥2 distinct eligible cats to form a pair
