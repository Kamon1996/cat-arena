export type Rating = {
  rating: number; // μ — Glicko-2 rating (display scale, start 1500)
  rd: number; // φ-equivalent rating deviation (display scale, start 350)
  vol: number; // σ — volatility (start 0.06)
};

export type Opponent = {
  rating: number; // opponent rating (display scale)
  rd: number; // opponent rating deviation (display scale)
  score: number; // outcome vs this opponent: 1 = win, 0 = loss, 0.5 = draw
};

// Glicko-2 system constants.
const SCALE = 173.7178; // display <-> internal Glicko-2 scale factor
const BASE_RATING = 1500; // display-scale rating that maps to internal μ = 0
const TAU = 0.5; // system constant: constrains volatility change over time
const CONVERGENCE_EPSILON = 0.000001; // volatility iteration tolerance
const RD_FLOOR = 30; // floor on rd (display scale) so ratings stay responsive
const RD_CEILING = 350; // cap on rd (display scale) for unrated/idle players

// conservativeScore coefficient (mirrors SCORE in src/lib/constants.ts).
const SCORE_RD_COEFFICIENT = 2;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Pure Glicko-2 update for one rating period.
 * Each vote is treated as a mini-period (single opponent in the array).
 * Applies a floor to rd so ratings stay responsive (see constants).
 * Returns the player's new Rating; does not mutate the input.
 */
export function updateGlicko2(player: Rating, opponents: Opponent[]): Rating {
  const mu = (player.rating - BASE_RATING) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.vol;

  // Step: no games this period -> RD increases by volatility only.
  if (opponents.length === 0) {
    const phiStarOnly = Math.sqrt(phi * phi + sigma * sigma);
    const rdOnly = clampRd(phiStarOnly * SCALE);
    return { rating: player.rating, rd: rdOnly, vol: sigma };
  }

  // Estimated variance (v) and rating-improvement numerator (deltaSum).
  let vInverse = 0;
  let deltaSum = 0;
  for (const opponent of opponents) {
    const muJ = (opponent.rating - BASE_RATING) / SCALE;
    const phiJ = opponent.rd / SCALE;
    const gPhiJ = g(phiJ);
    const eJ = expectedScore(mu, muJ, phiJ);
    vInverse += gPhiJ * gPhiJ * eJ * (1 - eJ);
    deltaSum += gPhiJ * (opponent.score - eJ);
  }
  const v = 1 / vInverse;
  const delta = v * deltaSum;

  // New volatility via Illinois-variant regula falsi on f(x).
  const newVol = solveVolatility(phi, v, delta, sigma);

  // Pre-rating-period RD, then update with this period's games.
  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: newMu * SCALE + BASE_RATING,
    rd: clampRd(newPhi * SCALE),
    vol: newVol,
  };
}

function solveVolatility(phi: number, v: number, delta: number, sigma: number): number {
  const a = Math.log(sigma * sigma);
  const phiSq = phi * phi;
  const deltaSq = delta * delta;

  const f = (x: number): number => {
    const ex = Math.exp(x);
    const numerator = ex * (deltaSq - phiSq - v - ex);
    const denominator = 2 * (phiSq + v + ex) * (phiSq + v + ex);
    return numerator / denominator - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B: number;
  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k += 1;
    }
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > CONVERGENCE_EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

function clampRd(rd: number): number {
  if (rd < RD_FLOOR) {
    return RD_FLOOR;
  }
  if (rd > RD_CEILING) {
    return RD_CEILING;
  }
  return rd;
}

/**
 * Conservative leaderboard score = rating - 2 * rd (lower bound of 95% CI).
 * Mirrors SCORE in src/lib/constants.ts.
 */
export function conservativeScore(r: Rating): number {
  return r.rating - SCORE_RD_COEFFICIENT * r.rd;
}
