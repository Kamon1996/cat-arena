import { CatStatus, ImageStatus } from "@prisma/client";

import { TOP_LEADERBOARD_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/r2";

const RANK_OFFSET = 1;

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

/** Top ACTIVE cats by conservative score, in rank order. */
export async function getLeaderboard(limit = TOP_LEADERBOARD_LIMIT): Promise<LeaderboardRow[]> {
  const cats = await prisma.cat.findMany({
    where: { status: CatStatus.ACTIVE },
    orderBy: { score: "desc" },
    take: limit,
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
        select: { r2Key: true },
      },
    },
  });

  // Standard competition ranking ("1,2,2,4"): tied scores share a rank. Computed
  // in-memory over the already-sorted rows so it matches getCatPage's
  // count(score > mine)+1 — no extra queries, consistent rank across /top and /cat.
  let rank = 0;
  let prevScore = Number.POSITIVE_INFINITY;
  return cats.map((cat, index) => {
    if (cat.score < prevScore) {
      rank = index + RANK_OFFSET;
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
      thumbUrl: cover ? publicUrl(cover.r2Key) : null,
    };
  });
}
