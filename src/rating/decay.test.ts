import { beforeEach, describe, expect, it, vi } from "vitest";

import { GLICKO_DEFAULT, SCORE } from "@/lib/constants";

const { findMany, update } = vi.hoisted(() => ({ findMany: vi.fn(), update: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { cat: { findMany, update } } }));

import { decayInactiveRatings } from "./decay";

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe("decayInactiveRatings", () => {
  it("queries only ACTIVE cats below the rd ceiling that are inactive", async () => {
    findMany.mockResolvedValue([]);
    await decayInactiveRatings();

    const where = findMany.mock.calls[0]?.[0]?.where;
    expect(where.status).toBe("ACTIVE");
    expect(where.rd).toEqual({ lt: GLICKO_DEFAULT.rd });
    expect(where.OR).toEqual([{ lastRatedAt: { lt: expect.any(Date) } }, { lastRatedAt: null }]);
  });

  it("inflates rd (rating unchanged) and recomputes score for each inactive cat", async () => {
    findMany.mockResolvedValue([{ id: "a", rating: 1500, rd: 100, vol: 0.06 }]);

    const result = await decayInactiveRatings();

    expect(result).toEqual({ decayed: 1 });
    expect(update).toHaveBeenCalledOnce();
    const call = update.mock.calls[0]?.[0];
    expect(call.where).toEqual({ id: "a" });
    // rd inflates toward the ceiling; rating stays put.
    expect(call.data.rd).toBeGreaterThan(100);
    expect(call.data.rd).toBeLessThanOrEqual(GLICKO_DEFAULT.rd);
    // score stays consistent with the new rd (rating unchanged at 1500).
    expect(call.data.score).toBeCloseTo(SCORE(1500, call.data.rd), 5);
  });

  it("returns decayed:0 and writes nothing when none are inactive", async () => {
    findMany.mockResolvedValue([]);
    const result = await decayInactiveRatings();
    expect(result).toEqual({ decayed: 0 });
    expect(update).not.toHaveBeenCalled();
  });
});
