import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const count = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cat: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      count: (...a: unknown[]) => count(...a),
    },
    vote: { findMany: (...a: unknown[]) => findMany(...a) },
  },
}));
vi.mock("@/lib/r2", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { getCatPage } from "@/data/cat-page";

describe("getCatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for a missing or non-ACTIVE cat", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getCatPage("ghost-1")).toBeNull();
  });

  it("returns null for an ACTIVE cat with no APPROVED images", async () => {
    findUnique.mockResolvedValue({
      id: "ca",
      name: "Fluffy",
      slug: "fluffy-1",
      status: "ACTIVE",
      rating: 1500,
      rd: 350,
      score: 800,
      wins: 0,
      losses: 0,
      images: [],
    });
    expect(await getCatPage("fluffy-1")).toBeNull();
  });

  it("maps APPROVED images via r2Key, computes rank, and lists recent duels", async () => {
    findUnique.mockResolvedValue({
      id: "ca",
      name: "Fluffy",
      slug: "fluffy-1",
      status: "ACTIVE",
      rating: 1600,
      rd: 80,
      wins: 12,
      losses: 4,
      score: 1440,
      images: [
        { r2Key: "seed/fluffy.webp", width: 800, height: 600, position: 0 },
        { r2Key: "cats/img2/original", width: 800, height: 600, position: 1 },
      ],
    });
    count.mockResolvedValue(7); // 7 cats above → rank 8
    findMany.mockResolvedValue([{ id: "v1", winnerCatId: "ca" }]);

    const page = await getCatPage("fluffy-1");
    expect(page?.name).toBe("Fluffy");
    expect(page?.rank).toBe(8);
    expect(page?.images[0]?.url).toBe("https://cdn.test/seed/fluffy.webp");
    expect(page?.recentDuels).toHaveLength(1);
    expect(page?.recentDuels[0]?.won).toBe(true);
    expect(page?.wins).toBe(12);
  });
});
