import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cat: {
      findMany: vi.fn(),
    },
  },
}));

import { PAIR_B_CANDIDATE_POOL, PAIR_B_SCORE_WINDOW } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { pickPair } from "./pick-pair";

const VOTER_KEY = "anon-123";
const A_ROW = {
  id: "a",
  rating: 1500,
  rd: 350,
  score: 800,
  timesShown: 0,
};
const B_NEAR = {
  id: "b",
  rating: 1500,
  rd: 90,
  score: 820,
  timesShown: 5,
};
const B_SELF = { ...A_ROW };

const findMany = vi.mocked(prisma.cat.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pickPair (global scope)", () => {
  it("queries ACTIVE cats with an APPROVED image and returns a pair", async () => {
    // First call: A-pool (status, rd). Second call: B-pool (status, score).
    findMany
      .mockResolvedValueOnce([A_ROW] as never)
      .mockResolvedValueOnce([A_ROW, B_NEAR] as never);

    const result = await pickPair({
      scope: "global",
      seenCatIds: [],
      voterKey: VOTER_KEY,
    });

    expect(result).not.toBeNull();
    expect(result?.a.id).toBe("a");
    expect(result?.b.id).toBe("b");

    // Eligibility filter present on the A-pool query.
    const aArgs = findMany.mock.calls[0]?.[0];
    expect(aArgs?.where?.status).toBe("ACTIVE");
    expect(aArgs?.where?.images?.some?.status).toBe("APPROVED");

    // B-pool query uses the (status, score) index: score window, ordered, capped.
    const bArgs = findMany.mock.calls[1]?.[0];
    expect(bArgs?.where?.score).toEqual({
      gte: A_ROW.score - PAIR_B_SCORE_WINDOW,
      lte: A_ROW.score + PAIR_B_SCORE_WINDOW,
    });
    expect(bArgs?.orderBy).toEqual({ score: "asc" });
    expect(bArgs?.take).toBe(PAIR_B_CANDIDATE_POOL);
  });

  it("returns null when no eligible candidates", async () => {
    findMany.mockResolvedValue([] as never);
    const result = await pickPair({
      scope: "global",
      seenCatIds: [],
      voterKey: VOTER_KEY,
    });
    expect(result).toBeNull();
  });

  it("excludes self (same id as A) from B", async () => {
    findMany
      .mockResolvedValueOnce([A_ROW] as never)
      .mockResolvedValueOnce([B_SELF, B_NEAR] as never);

    const result = await pickPair({
      scope: "global",
      seenCatIds: [],
      voterKey: VOTER_KEY,
    });
    expect(result?.b.id).toBe("b"); // self excluded by core
  });

  it("excludes seen cat ids from B", async () => {
    const SEEN = { id: "seen-cat", rating: 1500, rd: 90, score: 815, timesShown: 5 };
    findMany.mockResolvedValueOnce([A_ROW] as never).mockResolvedValueOnce([SEEN, B_NEAR] as never);

    const result = await pickPair({
      scope: "global",
      seenCatIds: [SEEN.id],
      voterKey: VOTER_KEY,
    });
    expect(result?.b.id).toBe("b"); // seen excluded by core
  });

  it("hard-excludes batch-reserved ids from BOTH pools", async () => {
    findMany
      .mockResolvedValueOnce([A_ROW] as never)
      .mockResolvedValueOnce([A_ROW, B_NEAR] as never);

    await pickPair({
      scope: "global",
      seenCatIds: [],
      voterKey: VOTER_KEY,
      excludedCatIds: ["x1", "x2"],
    });

    const aArgs = findMany.mock.calls[0]?.[0];
    const bArgs = findMany.mock.calls[1]?.[0];
    expect(aArgs?.where?.id).toEqual({ notIn: ["x1", "x2"] });
    expect(bArgs?.where?.id).toEqual({ notIn: ["x1", "x2"] });
  });

  it("omits the id filter when there are no exclusions", async () => {
    findMany
      .mockResolvedValueOnce([A_ROW] as never)
      .mockResolvedValueOnce([A_ROW, B_NEAR] as never);

    await pickPair({ scope: "global", seenCatIds: [], voterKey: VOTER_KEY, excludedCatIds: [] });

    const aArgs = findMany.mock.calls[0]?.[0];
    expect(aArgs?.where?.id).toBeUndefined();
  });
});

describe("pickPair (org scope)", () => {
  it("restricts the pool to org members", async () => {
    findMany
      .mockResolvedValueOnce([A_ROW] as never)
      .mockResolvedValueOnce([A_ROW, B_NEAR] as never);

    await pickPair({
      scope: { orgId: "org-1" },
      seenCatIds: [],
      voterKey: VOTER_KEY,
    });

    const aArgs = findMany.mock.calls[0]?.[0];
    expect(aArgs?.where?.orgs?.some?.orgId).toBe("org-1");
  });
});
