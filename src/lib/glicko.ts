import type { Prisma } from "@prisma/client";

import type { RatingSide } from "@/lib/api-types";
import { SCORE } from "@/lib/constants";
import { updateGlicko2 } from "@/rating/glicko2";

const WIN_SCORE = 1;
const LOSS_SCORE = 0;

export type ApplyVoteResult = {
  winner: RatingSide;
  loser: RatingSide;
};

export { applyVote };

/**
 * DB ↔ Glicko glue: load the two cats' ratings, run the pure Glicko-2 update for a
 * single winner-vs-loser period, persist both rows (rating/rd/vol + denormalized score
 * + win/loss + timesShown), and return the new conservative-scored sides. Runs inside
 * the caller's transaction so the global rating update is atomic with the vote insert.
 */
async function applyVote(
  tx: Prisma.TransactionClient,
  winnerCatId: string,
  loserCatId: string,
): Promise<ApplyVoteResult> {
  const ratingSelect = { id: true, rating: true, rd: true, vol: true } as const;
  const [winner, loser] = await Promise.all([
    tx.cat.findUniqueOrThrow({ where: { id: winnerCatId }, select: ratingSelect }),
    tx.cat.findUniqueOrThrow({ where: { id: loserCatId }, select: ratingSelect }),
  ]);

  const nextWinner = updateGlicko2({ rating: winner.rating, rd: winner.rd, vol: winner.vol }, [
    { rating: loser.rating, rd: loser.rd, score: WIN_SCORE },
  ]);
  const nextLoser = updateGlicko2({ rating: loser.rating, rd: loser.rd, vol: loser.vol }, [
    { rating: winner.rating, rd: winner.rd, score: LOSS_SCORE },
  ]);

  const ratedAt = new Date();
  const sideSelect = { id: true, rating: true, rd: true, score: true } as const;
  const [updatedWinner, updatedLoser] = await Promise.all([
    tx.cat.update({
      where: { id: winnerCatId },
      data: {
        rating: nextWinner.rating,
        rd: nextWinner.rd,
        vol: nextWinner.vol,
        score: SCORE(nextWinner.rating, nextWinner.rd),
        wins: { increment: 1 },
        timesShown: { increment: 1 },
        lastRatedAt: ratedAt,
      },
      select: sideSelect,
    }),
    tx.cat.update({
      where: { id: loserCatId },
      data: {
        rating: nextLoser.rating,
        rd: nextLoser.rd,
        vol: nextLoser.vol,
        score: SCORE(nextLoser.rating, nextLoser.rd),
        losses: { increment: 1 },
        timesShown: { increment: 1 },
        lastRatedAt: ratedAt,
      },
      select: sideSelect,
    }),
  ]);

  return { winner: updatedWinner, loser: updatedLoser };
}
