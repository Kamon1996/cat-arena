import { Plus } from "lucide-react";
import Link from "next/link";

import { requireUser } from "@/auth/guards";
import { Mimo } from "@/components/brand/mimo";
import type { CatCardData } from "@/components/dashboard/cat-card";
import { CatCard } from "@/components/dashboard/cat-card";
import { Button } from "@/components/ui/button";
import { MAX_CATS_PER_USER } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { fullUrl, thumbUrl } from "@/storage/keys";

const ACTIVE_STATUS = "ACTIVE";

export default async function DashboardPage() {
  const session = await requireUser();

  const cats = await prisma.cat.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      rating: true,
      rd: true,
      score: true,
      wins: true,
      losses: true,
      timesShown: true,
      images: {
        orderBy: { position: "asc" },
        select: { id: true, status: true, rejectionReasons: true, width: true, height: true },
      },
    },
  });

  const cards: CatCardData[] = await Promise.all(
    cats.map(async (cat) => {
      // Conservative-score leaderboard rank; only ACTIVE cats are ranked.
      const rank =
        cat.status === ACTIVE_STATUS
          ? (await prisma.cat.count({
              where: { status: ACTIVE_STATUS, score: { gt: cat.score } },
            })) + 1
          : null;

      return {
        id: cat.id,
        name: cat.name,
        status: cat.status,
        rank,
        score: cat.score,
        rating: cat.rating,
        rd: cat.rd,
        wins: cat.wins,
        losses: cat.losses,
        timesShown: cat.timesShown,
        images: cat.images.map((image) => ({
          id: image.id,
          status: image.status,
          rejectionReasons: image.rejectionReasons,
          width: image.width,
          height: image.height,
          thumbUrl: thumbUrl(image.id),
          // The lightbox shows the UNCROPPED 1600px variant — the photo as shot.
          fullUrl: fullUrl(image.id),
        })),
      };
    }),
  );

  const atLimit = cards.length >= MAX_CATS_PER_USER;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          <h1 className="font-display text-4xl font-bold tracking-tight">My cats</h1>
          <span className="pb-1 font-semibold text-muted-foreground">
            {cards.length} of {MAX_CATS_PER_USER} cats
          </span>
        </div>
        {atLimit ? null : (
          <Button asChild>
            <Link href="/upload">
              <Plus />
              Add a cat
            </Link>
          </Button>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Mimo mood="sleepy" className="size-32" />
          <h2 className="font-display text-2xl font-bold">You have no cats yet</h2>
          <p className="max-w-sm text-muted-foreground">
            Add your cat and let the world decide who&apos;s the cutest. It only takes a name and a
            photo.
          </p>
          <Button asChild size="lg" className="mt-1">
            <Link href="/upload">
              <Plus />
              Upload your first cat
            </Link>
          </Button>
        </div>
      ) : (
        <section className="grid items-start gap-6 lg:grid-cols-2">
          {cards.map((cat) => (
            <CatCard key={cat.id} cat={cat} />
          ))}
        </section>
      )}
    </main>
  );
}
