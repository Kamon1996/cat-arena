import { describe, expect, it } from "vitest";

import type { Opponent, Rating } from "./glicko2";
import { conservativeScore, updateGlicko2 } from "./glicko2";

// Glickman's worked Glicko-2 example (tau = 0.5):
// player μ=1500, RD=200, σ=0.06 vs three opponents in one rating period.
const GLICKMAN_PLAYER: Rating = { rating: 1500, rd: 200, vol: 0.06 };
const GLICKMAN_OPPONENTS: Opponent[] = [
  { rating: 1400, rd: 30, score: 1 }, // win
  { rating: 1550, rd: 100, score: 0 }, // loss
  { rating: 1700, rd: 300, score: 0 }, // loss
];
// Published reference results (3-decimal tolerance).
const GLICKMAN_EXPECTED_RATING = 1464.05;
const GLICKMAN_EXPECTED_RD = 151.52;
const GLICKMAN_EXPECTED_VOL = 0.05999;
const RATING_TOLERANCE = 0.05;
const RD_TOLERANCE = 0.05;
const VOL_TOLERANCE = 0.0001;
// Equal-rated win vs loss must be symmetric to within floating-point noise.
const SYMMETRY_TOLERANCE = 0.001;

// New-player vs settled-player single-vote behavior.
const NEW_PLAYER: Rating = { rating: 1500, rd: 350, vol: 0.06 };
const SETTLED_PLAYER: Rating = { rating: 1500, rd: 50, vol: 0.06 };
const EVEN_OPPONENT_NEW: Opponent[] = [{ rating: 1500, rd: 350, score: 1 }];
const EVEN_OPPONENT_NEW_LOSS: Opponent[] = [{ rating: 1500, rd: 350, score: 0 }];
const EVEN_OPPONENT_SETTLED: Opponent[] = [{ rating: 1500, rd: 50, score: 1 }];
// A new player must swing > 100 points on one win; a settled player < 20.
const NEW_PLAYER_MIN_SWING = 100;
const SETTLED_PLAYER_MAX_SWING = 20;

describe("updateGlicko2", () => {
  it("matches Glickman's published reference values for a 3-opponent rating period", () => {
    const result = updateGlicko2(GLICKMAN_PLAYER, GLICKMAN_OPPONENTS);

    expect(result.rating).toBeCloseTo(GLICKMAN_EXPECTED_RATING, 2);
    expect(result.rd).toBeCloseTo(GLICKMAN_EXPECTED_RD, 2);
    expect(result.vol).toBeCloseTo(GLICKMAN_EXPECTED_VOL, 4);
    // Explicit tolerance assertions as a second guard.
    expect(Math.abs(result.rating - GLICKMAN_EXPECTED_RATING)).toBeLessThan(RATING_TOLERANCE);
    expect(Math.abs(result.rd - GLICKMAN_EXPECTED_RD)).toBeLessThan(RD_TOLERANCE);
    expect(Math.abs(result.vol - GLICKMAN_EXPECTED_VOL)).toBeLessThan(VOL_TOLERANCE);
  });

  it("does not mutate the input player", () => {
    const input: Rating = { rating: 1500, rd: 200, vol: 0.06 };
    const snapshot = { ...input };
    updateGlicko2(input, GLICKMAN_OPPONENTS);
    expect(input).toEqual(snapshot);
  });

  it("reduces RD after a rating period (more games => more certainty)", () => {
    const result = updateGlicko2(GLICKMAN_PLAYER, GLICKMAN_OPPONENTS);
    expect(result.rd).toBeLessThan(GLICKMAN_PLAYER.rd);
  });

  it("moves a new (high-RD) player far on a single win", () => {
    const result = updateGlicko2(NEW_PLAYER, EVEN_OPPONENT_NEW);
    expect(result.rating - NEW_PLAYER.rating).toBeGreaterThan(NEW_PLAYER_MIN_SWING);
  });

  it("moves a new (high-RD) player symmetrically down on a single loss", () => {
    const win = updateGlicko2(NEW_PLAYER, EVEN_OPPONENT_NEW);
    const loss = updateGlicko2(NEW_PLAYER, EVEN_OPPONENT_NEW_LOSS);
    const upSwing = win.rating - NEW_PLAYER.rating;
    const downSwing = NEW_PLAYER.rating - loss.rating;
    expect(loss.rating).toBeLessThan(NEW_PLAYER.rating);
    expect(Math.abs(upSwing - downSwing)).toBeLessThan(SYMMETRY_TOLERANCE);
  });

  it("barely moves a settled (low-RD) player on a single win", () => {
    const result = updateGlicko2(SETTLED_PLAYER, EVEN_OPPONENT_SETTLED);
    expect(result.rating - SETTLED_PLAYER.rating).toBeLessThan(SETTLED_PLAYER_MAX_SWING);
  });
});

describe("conservativeScore", () => {
  it("returns rating - 2 * rd", () => {
    expect(conservativeScore({ rating: 1500, rd: 350, vol: 0.06 })).toBe(800);
    expect(conservativeScore({ rating: 1600, rd: 50, vol: 0.06 })).toBe(1500);
  });
});
