import "server-only";

import { DECAY_BATCH_LIMIT, DECAY_INACTIVITY_DAYS, GLICKO_DEFAULT, SCORE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { updateGlicko2 } from "@/rating/glicko2";

const MS_PER_DAY = 86_400_000;

export type DecayResult = { decayed: number };

/**
 * Glicko-2 RD-decay for inactive cats. A cat with no rating-affecting vote for
 * DECAY_INACTIVITY_DAYS is treated as having sat out a rating period: its rating
 * stays, but rd inflates (updateGlicko2 with no opponents) so it drifts back
 * toward the ceiling and re-enters the high-rd "needs data" pairing pool. Cats
 * already at the rd ceiling are excluded, so permanently-idle cats stop being
 * reprocessed. Bounded to DECAY_BATCH_LIMIT per run (cron runs daily).
 */
export async function decayInactiveRatings(now = new Date()): Promise<DecayResult> {
  const cutoff = new Date(now.getTime() - DECAY_INACTIVITY_DAYS * MS_PER_DAY);

  const cats = await prisma.cat.findMany({
    where: {
      status: "ACTIVE",
      rd: { lt: GLICKO_DEFAULT.rd },
      OR: [{ lastRatedAt: { lt: cutoff } }, { lastRatedAt: null }],
    },
    select: { id: true, rating: true, rd: true, vol: true },
    orderBy: { lastRatedAt: { sort: "asc", nulls: "first" } },
    take: DECAY_BATCH_LIMIT,
  });

  for (const cat of cats) {
    const next = updateGlicko2({ rating: cat.rating, rd: cat.rd, vol: cat.vol }, []);
    await prisma.cat.update({
      where: { id: cat.id },
      // rating is unchanged by an empty-opponents period; only rd/vol/score move.
      data: { rd: next.rd, vol: next.vol, score: SCORE(next.rating, next.rd) },
    });
  }

  return { decayed: cats.length };
}
