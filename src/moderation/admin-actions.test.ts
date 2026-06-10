import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  catImage: { update: vi.fn(), updateMany: vi.fn() },
  cat: { update: vi.fn(), findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // Supports both interactive (callback) and batch (array) transaction forms.
    $transaction: vi.fn(async (arg: ((t: typeof tx) => unknown) | Promise<unknown>[]) =>
      typeof arg === "function" ? arg(tx) : Promise.all(arg),
    ),
    catImage: { update: vi.fn(), updateMany: vi.fn() },
    cat: { update: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import type { RejectionReason } from "@/moderation/moderation-types";
import {
  approveCatImages,
  approveImage,
  banCat,
  deleteCat,
  hideCat,
  rejectCatImages,
  rejectImage,
} from "./admin-actions";

const IMAGE_ID = "img_1";
const CAT_ID = "cat_1";

describe("admin-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.catImage.update.mockResolvedValue({ id: IMAGE_ID, catId: CAT_ID });
    tx.cat.findUnique.mockResolvedValue({ id: CAT_ID, status: "PENDING" });
    tx.cat.update.mockResolvedValue({ id: CAT_ID, status: "ACTIVE" });
  });

  it("approveImage approves the image and promotes a non-banned cat to ACTIVE", async () => {
    await approveImage(IMAGE_ID);
    expect(tx.catImage.update).toHaveBeenCalledWith({
      where: { id: IMAGE_ID },
      data: { status: "APPROVED" },
      select: { catId: true },
    });
    expect(tx.cat.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { status: "ACTIVE", approvedAt: expect.any(Date) },
    });
  });

  it("approveImage does NOT promote a banned cat", async () => {
    tx.cat.findUnique.mockResolvedValueOnce({ id: CAT_ID, status: "BANNED" });
    await approveImage(IMAGE_ID);
    expect(tx.cat.update).not.toHaveBeenCalled();
  });

  it("rejectImage sets image REJECTED and frees its sha256", async () => {
    await rejectImage(IMAGE_ID);
    expect(prisma.catImage.update).toHaveBeenCalledWith({
      where: { id: IMAGE_ID },
      data: { status: "REJECTED", rejectionReasons: { set: [] }, sha256: null },
    });
  });

  it("rejectCatImages rejects all pending images, freeing their hashes", async () => {
    const reasons: RejectionReason[] = ["Not a cat", "Blurry / low-res"];
    await rejectCatImages(CAT_ID, reasons);
    expect(prisma.catImage.updateMany).toHaveBeenCalledWith({
      where: { catId: CAT_ID, status: "PENDING" },
      data: { status: "REJECTED", rejectionReasons: { set: reasons }, sha256: null },
    });
  });

  it("hideCat sets cat HIDDEN and keeps the hashes (hide is reversible)", async () => {
    await hideCat(CAT_ID);
    expect(prisma.cat.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { status: "HIDDEN" },
    });
    expect(prisma.catImage.updateMany).not.toHaveBeenCalled();
  });

  it("banCat sets cat BANNED and frees all its image hashes", async () => {
    await banCat(CAT_ID);
    expect(prisma.cat.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { status: "BANNED" },
    });
    expect(prisma.catImage.updateMany).toHaveBeenCalledWith({
      where: { catId: CAT_ID },
      data: { sha256: null },
    });
  });

  it("deleteCat deletes the cat", async () => {
    await deleteCat(CAT_ID);
    expect(prisma.cat.delete).toHaveBeenCalledWith({ where: { id: CAT_ID } });
  });

  describe("approveCatImages", () => {
    beforeEach(() => {
      tx.catImage.updateMany.mockResolvedValue({ count: 1 });
    });

    it("approves all PENDING images and promotes a non-banned cat", async () => {
      tx.cat.findUnique.mockResolvedValueOnce({ id: CAT_ID, status: "PENDING" });
      await approveCatImages(CAT_ID);
      expect(tx.catImage.updateMany).toHaveBeenCalledWith({
        where: { catId: CAT_ID, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      expect(tx.cat.update).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        data: { status: "ACTIVE", approvedAt: expect.any(Date) },
      });
    });

    it("does NOT promote a banned cat", async () => {
      tx.cat.findUnique.mockResolvedValueOnce({ id: CAT_ID, status: "BANNED" });
      await approveCatImages(CAT_ID);
      expect(tx.catImage.updateMany).toHaveBeenCalledWith({
        where: { catId: CAT_ID, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      expect(tx.cat.update).not.toHaveBeenCalled();
    });

    it("does NOT promote when no pending images were approved", async () => {
      tx.catImage.updateMany.mockResolvedValueOnce({ count: 0 });
      await approveCatImages(CAT_ID);
      expect(tx.cat.findUnique).not.toHaveBeenCalled();
      expect(tx.cat.update).not.toHaveBeenCalled();
    });
  });
});
