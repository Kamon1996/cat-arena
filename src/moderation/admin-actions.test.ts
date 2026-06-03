import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  catImage: { update: vi.fn(), updateMany: vi.fn() },
  cat: { update: vi.fn(), findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    catImage: { update: vi.fn() },
    cat: { update: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  approveCatImages,
  approveImage,
  banCat,
  deleteCat,
  hideCat,
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

  it("rejectImage sets image REJECTED", async () => {
    await rejectImage(IMAGE_ID);
    expect(prisma.catImage.update).toHaveBeenCalledWith({
      where: { id: IMAGE_ID },
      data: { status: "REJECTED" },
    });
  });

  it("hideCat sets cat HIDDEN", async () => {
    await hideCat(CAT_ID);
    expect(prisma.cat.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { status: "HIDDEN" },
    });
  });

  it("banCat sets cat BANNED", async () => {
    await banCat(CAT_ID);
    expect(prisma.cat.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { status: "BANNED" },
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
