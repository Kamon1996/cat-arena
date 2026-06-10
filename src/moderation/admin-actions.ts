import { prisma } from "@/lib/prisma";
import type { RejectionReason } from "@/moderation/moderation-types";

/** Approve one image; promote its cat to ACTIVE unless the cat is BANNED. */
export async function approveImage(imageId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const image = await tx.catImage.update({
      where: { id: imageId },
      data: { status: "APPROVED" },
      select: { catId: true },
    });
    const cat = await tx.cat.findUnique({
      where: { id: image.catId },
      select: { id: true, status: true },
    });
    if (cat && cat.status !== "BANNED") {
      await tx.cat.update({
        where: { id: cat.id },
        data: { status: "ACTIVE", approvedAt: new Date() },
      });
    }
  });
}

// Rejecting/banning frees the image's sha256 (set to null): rejected content
// must not reserve its hash forever, or a squatter's rejected copy would 409
// the legitimate owner's upload. A freed photo re-enters moderation on re-upload.
export async function rejectImage(imageId: string, reasons: RejectionReason[] = []): Promise<void> {
  await prisma.catImage.update({
    where: { id: imageId },
    data: { status: "REJECTED", rejectionReasons: { set: reasons }, sha256: null },
  });
}

/** Reject ALL pending images of a cat, recording the moderator's reasons. */
export async function rejectCatImages(catId: string, reasons: RejectionReason[]): Promise<void> {
  await prisma.catImage.updateMany({
    where: { catId, status: "PENDING" },
    data: { status: "REJECTED", rejectionReasons: { set: reasons }, sha256: null },
  });
}

// Hiding is reversible moderation — the cat may come back, so its hashes stay.
export async function hideCat(catId: string): Promise<void> {
  await prisma.cat.update({
    where: { id: catId },
    data: { status: "HIDDEN" },
  });
}

export async function banCat(catId: string): Promise<void> {
  await prisma.$transaction([
    prisma.cat.update({
      where: { id: catId },
      data: { status: "BANNED" },
    }),
    // A banned cat never returns to the arena — free its hashes (see rejectImage).
    prisma.catImage.updateMany({
      where: { catId },
      data: { sha256: null },
    }),
  ]);
}

export async function deleteCat(catId: string): Promise<void> {
  await prisma.cat.delete({ where: { id: catId } });
}

/** Approve ALL pending images of a cat; promote it to ACTIVE unless BANNED. */
export async function approveCatImages(catId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.catImage.updateMany({
      where: { catId, status: "PENDING" },
      data: { status: "APPROVED" },
    });
    if (count === 0) {
      return;
    }
    const cat = await tx.cat.findUnique({
      where: { id: catId },
      select: { status: true },
    });
    if (cat && cat.status !== "BANNED") {
      await tx.cat.update({
        where: { id: catId },
        data: { status: "ACTIVE", approvedAt: new Date() },
      });
    }
  });
}
