import { beforeEach, describe, expect, it, vi } from "vitest";

const { listKeys, deleteObjects, catFindMany } = vi.hoisted(() => ({
  listKeys: vi.fn(),
  deleteObjects: vi.fn(),
  catFindMany: vi.fn(),
}));

vi.mock("@/lib/r2", () => ({
  listKeys,
  deleteObjects,
  publicUrl: (k: string) => `https://cdn.test/${k}`,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { catImage: { findMany: catFindMany } } }));

import { cleanupOrphanImages } from "./cleanup-orphans";

const NOW = new Date("2026-06-09T00:00:00Z");
const OLD = new Date("2026-06-01T00:00:00Z"); // well past the 24h grace window
const FRESH = new Date("2026-06-08T23:00:00Z"); // within the grace window

beforeEach(() => {
  vi.clearAllMocks();
  deleteObjects.mockResolvedValue(undefined);
});

describe("cleanupOrphanImages", () => {
  it("deletes all keys for old originals with no CatImage row, keeps the rest", async () => {
    listKeys.mockResolvedValue([
      { key: "cats/orphan/original", lastModified: OLD }, // no row → delete
      { key: "cats/kept/original", lastModified: OLD }, // has row → keep
      { key: "cats/fresh/original", lastModified: FRESH }, // too new → keep
      { key: "cats/orphan/thumb.webp", lastModified: OLD }, // not an `original` → ignored as candidate
    ]);
    catFindMany.mockResolvedValue([{ id: "kept" }]);

    const result = await cleanupOrphanImages(NOW);

    // Only "orphan" + "kept" are old originals → candidates; "kept" exists → only "orphan" deleted.
    expect(catFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["orphan", "kept"] } },
      select: { id: true },
    });
    expect(deleteObjects).toHaveBeenCalledWith([
      "cats/orphan/original",
      "cats/orphan/thumb.webp",
      "cats/orphan/card.webp",
      "cats/orphan/full.webp",
    ]);
    expect(result).toEqual({ scanned: 4, deletedImages: 1 });
  });

  it("does nothing when there are no old original candidates", async () => {
    listKeys.mockResolvedValue([{ key: "cats/fresh/original", lastModified: FRESH }]);

    const result = await cleanupOrphanImages(NOW);

    expect(catFindMany).not.toHaveBeenCalled();
    expect(deleteObjects).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, deletedImages: 0 });
  });
});
