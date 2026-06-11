"use server";

import { requireModerator } from "@/auth/guards";
import { MODERATION_PAGE_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { ModerationPage } from "@/moderation/moderation-types";
import { fullUrl, thumbUrl } from "@/storage/keys";

export async function getModerationCats(cursor?: string): Promise<ModerationPage> {
  await requireModerator();
  const cats = await prisma.cat.findMany({
    where: { images: { some: { status: "PENDING" } } },
    orderBy: { createdAt: "asc" },
    take: MODERATION_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      owner: {
        select: { id: true, name: true, email: true, role: true, banned: true },
      },
      images: {
        where: { status: "PENDING" },
        orderBy: { position: "asc" },
        select: { id: true, width: true, height: true },
      },
    },
  });

  const hasMore = cats.length > MODERATION_PAGE_SIZE;
  const page = hasMore ? cats.slice(0, MODERATION_PAGE_SIZE) : cats;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return {
    cats: page.map((cat) => ({
      id: cat.id,
      name: cat.name,
      status: cat.status,
      createdAt: cat.createdAt.toISOString(),
      owner: cat.owner,
      images: cat.images.map((img) => ({
        id: img.id,
        thumbUrl: thumbUrl(img.id),
        fullUrl: fullUrl(img.id),
        width: img.width,
        height: img.height,
      })),
    })),
    nextCursor,
  };
}
