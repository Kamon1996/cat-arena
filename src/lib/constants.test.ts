import { describe, expect, it } from "vitest";

import {
  GLICKO_DEFAULT,
  MAX_CATS_PER_USER,
  MAX_IMAGES_PER_CAT,
  MAX_ORGS_PER_CAT,
  MAX_ORGS_PER_USER,
  SCORE,
} from "./constants";

const DEFAULT_SCORE = 800;
const SAMPLE_RATING = 1600;
const SAMPLE_RD = 100;
const SAMPLE_SCORE = 1400;

describe("constants", () => {
  it("exposes the entity limits from the contracts", () => {
    expect(MAX_CATS_PER_USER).toBe(2);
    expect(MAX_IMAGES_PER_CAT).toBe(3);
    expect(MAX_ORGS_PER_USER).toBe(1);
    expect(MAX_ORGS_PER_CAT).toBe(2);
  });

  it("SCORE computes the conservative lower bound rating - 2*rd", () => {
    expect(SCORE(SAMPLE_RATING, SAMPLE_RD)).toBe(SAMPLE_SCORE);
  });

  it("the Glicko defaults reduce to the denormalized Prisma score default", () => {
    expect(SCORE(GLICKO_DEFAULT.rating, GLICKO_DEFAULT.rd)).toBe(DEFAULT_SCORE);
  });
});
