import { prisma } from "@/lib/prisma";

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

export async function rejectImage(imageId: string): Promise<void> {
  await prisma.catImage.update({
    where: { id: imageId },
    data: { status: "REJECTED" },
  });
}

export async function hideCat(catId: string): Promise<void> {
  await prisma.cat.update({
    where: { id: catId },
    data: { status: "HIDDEN" },
  });
}

export async function banCat(catId: string): Promise<void> {
  await prisma.cat.update({
    where: { id: catId },
    data: { status: "BANNED" },
  });
}

export async function deleteCat(catId: string): Promise<void> {
  await prisma.cat.delete({ where: { id: catId } });
}
