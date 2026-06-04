import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cat: {
      count: (...a: unknown[]) => count(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
  },
}));
vi.mock("@/lib/r2", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));
// unstable_cache only adds a caching wrapper; the pure getLeaderboard is what we test.
vi.mock("next/cache", () => ({
  unstable_cache: <T>(fn: T) => fn,
}));

import { getLeaderboard } from "@/data/leaderboard";

const DEFAULT_PAGE_SIZE = 100;

function row(id: string, score: number, images: { r2Key: string }[] = []) {
  return { id, name: id.toUpperCase(), slug: id, score, rating: 1500, wins: 0, losses: 0, images };
}

describe("getLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries ACTIVE cats by score desc with page-1 offset and resolves the cover via r2Key", async () => {
    count.mockResolvedValue(2);
    findMany.mockResolvedValue([row("a", 100, [{ r2Key: "a.webp" }]), row("b", 90, [])]);

    const { rows, page, pageSize, total, pageCount } = await getLeaderboard();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "ACTIVE" },
        orderBy: { score: "desc" },
        skip: 0,
        take: DEFAULT_PAGE_SIZE,
      }),
    );
    expect(rows[0]?.thumbUrl).toBe("https://cdn.test/a.webp");
    expect(rows[1]?.thumbUrl).toBeNull();
    expect({ page, pageSize, total, pageCount }).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      total: 2,
      pageCount: 1,
    });
    // Page 1 needs no extra "strictly-greater" count — the top row is always rank 1.
    expect(count).toHaveBeenCalledTimes(1);
  });

  it("assigns tie-aware ranks (1,2,2,4) matching getCatPage's count-based rank", async () => {
    count.mockResolvedValue(4);
    findMany.mockResolvedValue([row("a", 100), row("b", 90), row("c", 90), row("d", 80)]);

    const { rows } = await getLeaderboard();

    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("continues global, tie-aware ranks across pages (tie straddling the boundary)", async () => {
    // Global order: 100, 90, 90, 80, 70. Page 2 (size 2) = the 3rd & 4th cats.
    count.mockResolvedValueOnce(5); // total
    count.mockResolvedValueOnce(1); // cats with score strictly > 90 (just the 100)
    findMany.mockResolvedValue([row("c", 90), row("d", 80)]);

    const { rows, page, total, pageCount } = await getLeaderboard(2, 2);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 2, take: 2 }));
    // The first page-2 row ties the 90 on page 1 → rank 2; the 80 drops to global rank 4.
    expect(rows.map((r) => r.rank)).toEqual([2, 4]);
    expect({ page, total, pageCount }).toEqual({ page: 2, total: 5, pageCount: 3 });
  });

  it("ranks a page-2 first row by the count of strictly-greater cats (no boundary tie)", async () => {
    // Global order: 100, 90, 80, 70. Page 2 (size 2) = 80, 70.
    count.mockResolvedValueOnce(4); // total
    count.mockResolvedValueOnce(2); // cats with score strictly > 80
    findMany.mockResolvedValue([row("c", 80), row("d", 70)]);

    const { rows } = await getLeaderboard(2, 2);

    expect(rows.map((r) => r.rank)).toEqual([3, 4]);
  });

  it("returns no rows but correct metadata for a page beyond the data", async () => {
    count.mockResolvedValue(3); // total only — the empty page short-circuits before the rank count
    findMany.mockResolvedValue([]);

    const { rows, page, total, pageCount } = await getLeaderboard(5, 2);

    expect(rows).toEqual([]);
    expect({ page, total, pageCount }).toEqual({ page: 5, total: 3, pageCount: 2 });
    expect(count).toHaveBeenCalledTimes(1);
  });

  it("clamps a non-positive page to 1", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    const { page, pageCount } = await getLeaderboard(0);

    expect(page).toBe(1);
    expect(pageCount).toBe(1); // pageCount is always at least 1
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });
});
