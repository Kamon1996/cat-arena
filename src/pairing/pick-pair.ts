import type { Cat } from "@prisma/client";

import { PAIR_A_CANDIDATE_POOL, PAIR_B_CANDIDATE_POOL, PAIR_B_SCORE_WINDOW } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { type Candidate, pickPairCore } from "./pick-pair-core";

const CAT_ACTIVE = "ACTIVE" as const;
const IMAGE_APPROVED = "APPROVED" as const;

export type PairScope = "global" | { orgId: string };

export type PickPairOptions = {
  scope: PairScope;
  seenCatIds: string[];
  voterKey: string;
  /**
   * Hard exclusion from BOTH pools (unlike seenCatIds, which only filters B).
   * Used when generating a batch of pairs: cats reserved by earlier pairs in
   * the batch must not appear again, so a queue of N pairs has 2N distinct cats.
   */
  excludedCatIds?: string[];
};

export type PickedPair = {
  a: Pick<Cat, "id" | "rating" | "rd" | "score" | "timesShown">;
  b: Pick<Cat, "id" | "rating" | "rd" | "score" | "timesShown">;
};

export { pickPair };

const CANDIDATE_SELECT = {
  id: true,
  rating: true,
  rd: true,
  score: true,
  timesShown: true,
} as const;

function eligibilityWhere(scope: PairScope) {
  const base = {
    status: CAT_ACTIVE,
    images: { some: { status: IMAGE_APPROVED } },
  };
  if (scope === "global") {
    return base;
  }
  return { ...base, orgs: { some: { orgId: scope.orgId } } };
}

async function pickPair(opts: PickPairOptions): Promise<PickedPair | null> {
  const excludedCatIds = opts.excludedCatIds ?? [];
  const where = {
    ...eligibilityWhere(opts.scope),
    ...(excludedCatIds.length > 0 ? { id: { notIn: excludedCatIds } } : {}),
  };

  // A-pool: small set with highest rd via the (status, rd) index — never full-table.
  const aPool = (await prisma.cat.findMany({
    where,
    select: CANDIDATE_SELECT,
    orderBy: { rd: "desc" },
    take: PAIR_A_CANDIDATE_POOL,
  })) as Candidate[];

  if (aPool.length === 0) {
    return null;
  }

  // B-pool covers the FULL A-pool score range ±window, so whichever A the core picks
  // (weighted by rd) has its score-window opponents present. Fetching only around the
  // highest-rd cat could miss the chosen A's neighbours once scores spread — which made
  // a small pool unpairable after a few votes.
  const scores = aPool.map((c) => c.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const bPool = (await prisma.cat.findMany({
    where: {
      ...where,
      score: {
        gte: minScore - PAIR_B_SCORE_WINDOW,
        lte: maxScore + PAIR_B_SCORE_WINDOW,
      },
    },
    select: CANDIDATE_SELECT,
    orderBy: { score: "asc" },
    take: PAIR_B_CANDIDATE_POOL,
  })) as Candidate[];

  return pickPairCore({
    aPool,
    bPool,
    seenCatIds: opts.seenCatIds,
    rng: Math.random,
  });
}
