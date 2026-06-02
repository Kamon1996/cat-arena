import { describe, expect, it, vi } from "vitest";

import { applyVote } from "./glicko";

const START_RATING = 1500;
const WINNER_ROW = { id: "ca", rating: START_RATING, rd: 350, vol: 0.06 };
const LOSER_ROW = { id: "cb", rating: START_RATING, rd: 350, vol: 0.06 };

function makeTx() {
  const findUniqueOrThrow = vi.fn(async ({ where }: { where: { id: string } }) =>
    where.id === WINNER_ROW.id ? WINNER_ROW : LOSER_ROW,
  );
  const update = vi.fn(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { rating: number; rd: number; score: number };
    }) => ({
      id: where.id,
      rating: data.rating,
      rd: data.rd,
      score: data.score,
    }),
  );
  return { cat: { findUniqueOrThrow, update } };
}

describe("applyVote", () => {
  it("moves the winner up and the loser down, persisting both rows", async () => {
    const tx = makeTx();
    const result = await applyVote(tx as never, "ca", "cb");

    expect(result.winner.id).toBe("ca");
    expect(result.loser.id).toBe("cb");
    // Equal-rated new (high-rd) players: the winner gains and the loser loses.
    expect(result.winner.rating).toBeGreaterThan(START_RATING);
    expect(result.loser.rating).toBeLessThan(START_RATING);
    expect(tx.cat.findUniqueOrThrow).toHaveBeenCalledTimes(2);
    expect(tx.cat.update).toHaveBeenCalledTimes(2);
  });

  it("persists the conservative score (rating - 2*rd) on each side", async () => {
    const tx = makeTx();
    const result = await applyVote(tx as never, "ca", "cb");
    expect(result.winner.score).toBeCloseTo(result.winner.rating - 2 * result.winner.rd, 5);
    expect(result.loser.score).toBeCloseTo(result.loser.rating - 2 * result.loser.rd, 5);
  });
});
