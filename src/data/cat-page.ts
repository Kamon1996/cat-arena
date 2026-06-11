import { CatStatus, ImageStatus } from "@prisma/client";

import { RECENT_DUELS_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { fullUrl } from "@/storage/keys";

const RANK_OFFSET = 1;

export type CatPageImage = {
  url: string;
  width: number;
  height: number;
};

export type CatPageDuel = {
  id: string;
  won: boolean;
};

export type CatPage = {
  id: string;
  name: string;
  slug: string;
  rating: number;
  rd: number;
  score: number;
  wins: number;
  losses: number;
  rank: number;
  images: CatPageImage[];
  recentDuels: CatPageDuel[];
};

/** Load an ACTIVE cat by slug with rank, APPROVED images, and recent duels. */
export async function getCatPage(slug: string): Promise<CatPage | null> {
  const cat = await prisma.cat.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      rating: true,
      rd: true,
      score: true,
      wins: true,
      losses: true,
      images: {
        where: { status: ImageStatus.APPROVED },
        orderBy: { position: "asc" },
        select: { id: true, width: true, height: true, position: true },
      },
    },
  });

  if (!cat || cat.status !== CatStatus.ACTIVE || cat.images.length === 0) {
    return null;
  }

  const above = await prisma.cat.count({
    where: { status: CatStatus.ACTIVE, score: { gt: cat.score } },
  });

  const votes = await prisma.vote.findMany({
    where: {
      OR: [{ winnerCatId: cat.id }, { loserCatId: cat.id }],
    },
    orderBy: { createdAt: "desc" },
    take: RECENT_DUELS_LIMIT,
    select: { id: true, winnerCatId: true },
  });

  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    rating: cat.rating,
    rd: cat.rd,
    score: cat.score,
    wins: cat.wins,
    losses: cat.losses,
    rank: above + RANK_OFFSET,
    // full.webp = the UNCROPPED 1600px variant with EXIF stripped. Never the
    // raw original: it carries the uploader's EXIF (incl. GPS) and was never
    // meant to be public. All rows have the variant (backfilled 2026-06-12).
    images: cat.images.map((img) => ({
      url: fullUrl(img.id),
      width: img.width,
      height: img.height,
    })),
    recentDuels: votes.map((vote) => ({
      id: vote.id,
      won: vote.winnerCatId === cat.id,
    })),
  };
}
