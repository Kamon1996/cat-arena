import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnedCatMock,
  ingestMock,
  deleteObjectsMock,
  catUpdate,
  catDelete,
  imageFindMany,
  imageFindUnique,
  imageCreate,
  imageDelete,
  imageCount,
} = vi.hoisted(() => ({
  requireOwnedCatMock: vi.fn(),
  ingestMock: vi.fn(),
  deleteObjectsMock: vi.fn(),
  catUpdate: vi.fn(),
  catDelete: vi.fn(),
  imageFindMany: vi.fn(),
  imageFindUnique: vi.fn(),
  imageCreate: vi.fn(),
  imageDelete: vi.fn(),
  imageCount: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/cats/owner-guard", () => ({ requireOwnedCat: requireOwnedCatMock }));
vi.mock("@/storage/ingest-image", () => ({ ingestImage: ingestMock }));
vi.mock("@/lib/r2", () => ({ deleteObjects: deleteObjectsMock, publicUrl: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cat: { update: catUpdate, delete: catDelete },
    catImage: {
      findMany: imageFindMany,
      findUnique: imageFindUnique,
      create: imageCreate,
      delete: imageDelete,
      count: imageCount,
    },
  },
}));

import { addCatImage, deleteCatImage, deleteCatOwned, renameCat } from "./owner-actions";

const SESSION = { user: { id: "user_1" }, expires: "2999-01-01" };
function owned(status = "ACTIVE") {
  return {
    ok: true,
    session: SESSION,
    cat: { id: "cat_1", ownerId: "user_1", status },
  };
}

describe("owner-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnedCatMock.mockResolvedValue(owned());
    ingestMock.mockResolvedValue({ width: 800, height: 600, status: "PENDING" });
    imageFindMany.mockResolvedValue([{ position: 0 }]);
    imageFindUnique.mockResolvedValue({ id: "img_1", catId: "cat_1" });
    imageCount.mockResolvedValue(2);
  });

  describe("renameCat", () => {
    it("updates name only and succeeds", async () => {
      const res = await renameCat("cat_1", "  New Name  ");
      expect(res).toEqual({ ok: true });
      expect(catUpdate).toHaveBeenCalledWith({
        where: { id: "cat_1" },
        data: { name: "New Name" },
      });
    });
    it("rejects an empty name", async () => {
      const res = await renameCat("cat_1", "   ");
      expect(res).toEqual({ ok: false, error: "invalid_name" });
      expect(catUpdate).not.toHaveBeenCalled();
    });
    it("propagates a forbidden owner-guard result", async () => {
      requireOwnedCatMock.mockResolvedValueOnce({ ok: false, error: "forbidden" });
      const res = await renameCat("cat_1", "X");
      expect(res).toEqual({ ok: false, error: "forbidden" });
    });
    it("refuses to rename a BANNED cat", async () => {
      requireOwnedCatMock.mockResolvedValueOnce(owned("BANNED"));
      const res = await renameCat("cat_1", "X");
      expect(res).toEqual({ ok: false, error: "banned" });
    });
  });

  describe("addCatImage", () => {
    it("creates the image at position max+1 with the screened status", async () => {
      imageFindMany.mockResolvedValueOnce([{ position: 0 }, { position: 1 }]);
      const res = await addCatImage("cat_1", "cats/img_new/original");
      expect(res).toEqual({ ok: true });
      expect(ingestMock).toHaveBeenCalledWith("img_new");
      expect(imageCreate).toHaveBeenCalledWith({
        data: {
          id: "img_new",
          catId: "cat_1",
          r2Key: "cats/img_new/original",
          width: 800,
          height: 600,
          position: 2,
          status: "PENDING",
        },
      });
    });
    it("refuses when the cat already has MAX_IMAGES_PER_CAT images", async () => {
      imageFindMany.mockResolvedValueOnce([{ position: 0 }, { position: 1 }, { position: 2 }]);
      const res = await addCatImage("cat_1", "cats/img_new/original");
      expect(res).toEqual({ ok: false, error: "image_limit" });
      expect(imageCreate).not.toHaveBeenCalled();
    });
    it("rejects a malformed r2Key", async () => {
      const res = await addCatImage("cat_1", "not/a/valid/key");
      expect(res).toEqual({ ok: false, error: "invalid_key" });
    });
    it("refuses on a BANNED cat", async () => {
      requireOwnedCatMock.mockResolvedValueOnce(owned("BANNED"));
      const res = await addCatImage("cat_1", "cats/img_new/original");
      expect(res).toEqual({ ok: false, error: "banned" });
    });
  });

  describe("deleteCatImage", () => {
    it("refuses to delete the last image", async () => {
      imageCount.mockResolvedValueOnce(1);
      const res = await deleteCatImage("img_1");
      expect(res).toEqual({ ok: false, error: "last_image" });
      expect(imageDelete).not.toHaveBeenCalled();
    });
    it("deletes the image and its R2 objects", async () => {
      imageCount.mockResolvedValueOnce(3);
      const res = await deleteCatImage("img_1");
      expect(res).toEqual({ ok: true });
      expect(imageDelete).toHaveBeenCalledWith({ where: { id: "img_1" } });
      expect(deleteObjectsMock).toHaveBeenCalledWith([
        "cats/img_1/original",
        "cats/img_1/thumb.webp",
        "cats/img_1/card.webp",
      ]);
    });
    it("returns not_found when the image is missing", async () => {
      imageFindUnique.mockResolvedValueOnce(null);
      const res = await deleteCatImage("img_x");
      expect(res).toEqual({ ok: false, error: "not_found" });
    });
    it("refuses on a BANNED cat", async () => {
      requireOwnedCatMock.mockResolvedValueOnce(owned("BANNED"));
      imageCount.mockResolvedValueOnce(3);
      const res = await deleteCatImage("img_1");
      expect(res).toEqual({ ok: false, error: "banned" });
    });
  });

  describe("deleteCatOwned", () => {
    it("deletes the cat and all its image R2 objects (allowed even if BANNED)", async () => {
      requireOwnedCatMock.mockResolvedValueOnce(owned("BANNED"));
      imageFindMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
      const res = await deleteCatOwned("cat_1");
      expect(res).toEqual({ ok: true });
      expect(catDelete).toHaveBeenCalledWith({ where: { id: "cat_1" } });
      expect(deleteObjectsMock).toHaveBeenCalledWith([
        "cats/a/original",
        "cats/a/thumb.webp",
        "cats/a/card.webp",
        "cats/b/original",
        "cats/b/thumb.webp",
        "cats/b/card.webp",
      ]);
    });
  });
});
