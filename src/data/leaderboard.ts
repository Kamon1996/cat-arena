import { CatStatus, ImageStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { ISR_REVALIDATE_SECONDS, TOP_LEADERBOARD_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { thumbUrl } from "@/storage/keys";

const RANK_OFFSET = 1;
const FIRST_PAGE = 1;
/** Cache tag — revalidate with revalidateTag(LEADERBOARD_CACHE_TAG) after rating changes. */
export const LEADERBOARD_CACHE_TAG = "leaderboard";

export type LeaderboardRow = {
  rank: number;
  id: string;
  name: string;
  slug: string;
  score: number;
  rating: number;
  wins: number;
  losses: number;
  thumbUrl: string | null;
};

export type LeaderboardPage = {
  rows: LeaderboardRow[];
  /** The (1-based) page actually returned — clamped to ≥ 1. */
  page: number;
  pageSize: number;
  /** Total ACTIVE cats (drives whether pagination shows + the page count). */
  total: number;
  /** Number of pages — always ≥ 1 so the UI has a stable lower bound. */
  pageCount: number;
};

/**
 * One page of the leaderboard: top ACTIVE cats by conservative score, in rank order.
 *
 * Ranks are GLOBAL and tie-aware (standard competition ranking "1,2,2,4"), staying
 * consistent across pages and with getCatPage's `count(score > mine) + 1`:
 *   rank(first row) = (ACTIVE cats with a strictly greater score) + 1
 * which also folds in ties that straddle the previous page boundary. Subsequent
 * rank jumps land on the global index (skip + index + 1) at each score drop.
 *
 * Pure (no request-scoped state) so it is unit-testable; the page consumes the
 * cached wrapper below.
 */
export async function getLeaderboard(
  page = FIRST_PAGE,
  pageSize = TOP_LEADERBOARD_LIMIT,
): Promise<LeaderboardPage> {
  const safePage = Math.max(FIRST_PAGE, Math.trunc(page) || FIRST_PAGE);
  const skip = (safePage - 1) * pageSize;

  const [total, cats] = await Promise.all([
    prisma.cat.count({ where: { status: CatStatus.ACTIVE } }),
    prisma.cat.findMany({
      where: { status: CatStatus.ACTIVE },
      orderBy: { score: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        score: true,
        rating: true,
        wins: true,
        losses: true,
        images: {
          where: { status: ImageStatus.APPROVED },
          orderBy: { position: "asc" },
          take: 1,
          select: { id: true },
        },
      },
    }),
  ]);

  const pageCount = Math.max(FIRST_PAGE, Math.ceil(total / pageSize));

  const firstCat = cats[0];
  if (!firstCat) {
    return { rows: [], page: safePage, pageSize, total, pageCount };
  }

  const firstScore = firstCat.score;
  // The first row's global rank. For page 1 it is 1; for later pages we count how
  // many cats outrank it (tie-aware across the boundary) — one cheap indexed count.
  const greater =
    skip === 0
      ? 0
      : await prisma.cat.count({
          where: { status: CatStatus.ACTIVE, score: { gt: firstScore } },
        });

  let rank = greater + RANK_OFFSET;
  let prevScore = firstScore;
  const rows = cats.map((cat, index) => {
    if (cat.score < prevScore) {
      rank = skip + index + RANK_OFFSET;
      prevScore = cat.score;
    }
    const cover = cat.images[0];
    return {
      rank,
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      score: cat.score,
      rating: cat.rating,
      wins: cat.wins,
      losses: cat.losses,
      // Derived 200px variant, not the raw original (EXIF-stripped + light).
      thumbUrl: cover ? thumbUrl(cover.id) : null,
    };
  });

  return { rows, page: safePage, pageSize, total, pageCount };
}

/**
 * Cached leaderboard read for the /top page. The route is dynamic (it reads the
 * `?page` search param), so we cache the DB read per page instead of relying on
 * route-level ISR — same staleness budget as the old `revalidate = 3600`.
 */
export const getCachedLeaderboard = unstable_cache(getLeaderboard, ["leaderboard"], {
  revalidate: ISR_REVALIDATE_SECONDS,
  tags: [LEADERBOARD_CACHE_TAG],
});
