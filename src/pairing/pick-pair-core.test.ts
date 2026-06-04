import { describe, expect, it } from "vitest";

import { PAIR_B_SCORE_WINDOW, PAIR_EPSILON } from "@/lib/constants";
import { type Candidate, pickPairCore, selectWeightedIndex, weightForA } from "./pick-pair-core";

const RATING_DEFAULT = 1500;

// Deterministic RNG: returns the queued values in order, then repeats the last.
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)] ?? 0;
    i += 1;
    return v;
  };
}

function cat(id: string, score: number, rd: number, timesShown: number): Candidate {
  return { id, rating: RATING_DEFAULT, rd, score, timesShown };
}

describe("weightForA", () => {
  it("weights higher rd more heavily", () => {
    expect(weightForA(cat("x", 800, 350, 0))).toBeGreaterThan(weightForA(cat("y", 800, 100, 0)));
  });

  it("weights low timesShown more heavily", () => {
    expect(weightForA(cat("fresh", 800, 200, 0))).toBeGreaterThan(
      weightForA(cat("shown", 800, 200, 99)),
    );
  });

  it("equals rd / sqrt(timesShown + 1)", () => {
    // rd 200, timesShown 3 => 200 / sqrt(4) = 100
    expect(weightForA(cat("c", 800, 200, 3))).toBeCloseTo(100, 5);
  });
});

describe("selectWeightedIndex", () => {
  it("returns -1 for empty weights", () => {
    expect(selectWeightedIndex([], seededRng([0.5]))).toBe(-1);
  });

  it("picks the bucket the random draw lands in", () => {
    // weights [1, 3] => total 4; rng 0.5 -> 2.0 lands in second bucket (>=1)
    expect(selectWeightedIndex([1, 3], seededRng([0.5]))).toBe(1);
    // rng 0.1 -> 0.4 lands in first bucket (<1)
    expect(selectWeightedIndex([1, 3], seededRng([0.1]))).toBe(0);
  });
});

describe("pickPairCore", () => {
  it("returns null when fewer than two eligible cats", () => {
    expect(
      pickPairCore({
        aPool: [cat("a", 800, 350, 0)],
        bPool: [],
        seenCatIds: [],
        rng: seededRng([0]),
      }),
    ).toBeNull();
  });

  it("excludes A itself and seen ids from B", () => {
    const result = pickPairCore({
      aPool: [cat("a", 800, 350, 0)],
      bPool: [
        cat("a", 800, 350, 0), // same as A — must be excluded
        cat("seen", 810, 90, 5), // seen — must be excluded
        cat("b", 820, 90, 5), // valid B
      ],
      seenCatIds: ["seen"],
      // rng[0] picks A (only one weight), rng[1] = 0.99 => no epsilon, pick closest
      rng: seededRng([0, 0.99]),
    });
    expect(result).not.toBeNull();
    expect(result?.a.id).toBe("a");
    expect(result?.b.id).toBe("b");
  });

  it("only picks B within the score window of A", () => {
    const aScore = 800;
    const result = pickPairCore({
      aPool: [cat("a", aScore, 350, 0)],
      bPool: [
        cat("far", aScore + PAIR_B_SCORE_WINDOW + 1, 90, 5), // out of window
        cat("near", aScore + 50, 90, 5), // in window
      ],
      seenCatIds: [],
      rng: seededRng([0, 0.99]),
    });
    expect(result?.b.id).toBe("near");
  });

  it("falls back to the closest eligible B when none is inside the window", () => {
    const aScore = 800;
    const result = pickPairCore({
      aPool: [cat("a", aScore, 350, 0)],
      bPool: [
        cat("far", aScore + PAIR_B_SCORE_WINDOW + 1, 90, 5),
        cat("farther", aScore + PAIR_B_SCORE_WINDOW + 400, 90, 5),
      ],
      seenCatIds: [],
      rng: seededRng([0, 0.99]),
    });
    // No in-window opponent, but eligible cats exist → still forms a pair (closest).
    expect(result?.b.id).toBe("far");
  });

  it("returns null when the only other cats are A itself or already seen", () => {
    const result = pickPairCore({
      aPool: [cat("a", 800, 350, 0)],
      bPool: [cat("a", 800, 350, 0), cat("seen", 810, 90, 5)],
      seenCatIds: ["seen"],
      rng: seededRng([0, 0.99]),
    });
    expect(result).toBeNull();
  });

  it("picks a random in-window B when epsilon roll hits", () => {
    const aScore = 800;
    // rng: [0]=A pick, [1]=epsilon roll (< PAIR_EPSILON => random branch),
    // [2]=index pick (0.99 -> last in-window candidate)
    const epsilonHit = PAIR_EPSILON / 2;
    const result = pickPairCore({
      aPool: [cat("a", aScore, 350, 0)],
      bPool: [cat("closest", aScore + 5, 90, 5), cat("further", aScore + 60, 90, 5)],
      seenCatIds: [],
      rng: seededRng([0, epsilonHit, 0.99]),
    });
    expect(result?.b.id).toBe("further");
  });
});
