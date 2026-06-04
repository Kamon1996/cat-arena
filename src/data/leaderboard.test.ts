import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { cat: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/lib/r2", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { getLeaderboard } from "@/data/leaderboard";

function row(id: string, score: number, images: { r2Key: string }[] = []) {
  return { id, name: id.toUpperCase(), slug: id, score, rating: 1500, wins: 0, losses: 0, images };
}

describe("getLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries ACTIVE cats ordered by score desc and resolves the cover via r2Key", async () => {
    findMany.mockResolvedValue([row("a", 100, [{ r2Key: "a.webp" }]), row("b", 90, [])]);
    const rows = await getLeaderboard();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACTIVE" }, orderBy: { score: "desc" } }),
    );
    expect(rows[0]?.thumbUrl).toBe("https://cdn.test/a.webp");
    expect(rows[1]?.thumbUrl).toBeNull();
  });

  it("assigns tie-aware ranks (1,2,2,4) matching getCatPage's count-based rank", async () => {
    findMany.mockResolvedValue([row("a", 100), row("b", 90), row("c", 90), row("d", 80)]);
    const rows = await getLeaderboard();
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });
});
