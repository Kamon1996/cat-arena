import { Cat, Plus } from "lucide-react";
import Link from "next/link";

import { requireUser } from "@/auth/guards";
import type { CatCardData } from "@/components/dashboard/cat-card";
import { CatCard } from "@/components/dashboard/cat-card";
import { Button } from "@/components/ui/button";
import { MAX_CATS_PER_USER } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { thumbUrl } from "@/storage/keys";

export default async function DashboardPage() {
  const session = await requireUser();

  const cats = await prisma.cat.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      images: {
        orderBy: { position: "asc" },
        select: { id: true, status: true },
      },
    },
  });

  const cards: CatCardData[] = cats.map((cat) => ({
    id: cat.id,
    name: cat.name,
    status: cat.status,
    images: cat.images.map((image) => ({
      id: image.id,
      status: image.status,
      thumbUrl: thumbUrl(image.id),
    })),
  }));

  const atLimit = cards.length >= MAX_CATS_PER_USER;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">My cats</h1>
          <p className="text-muted-foreground text-sm">
            {cards.length} of {MAX_CATS_PER_USER} cats
          </p>
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
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Cat className="size-10 text-muted-foreground" />
          <p className="font-medium">You have no cats yet</p>
          <p className="max-w-sm text-muted-foreground text-sm">
            Upload your first cat to enter the arena and start collecting votes.
          </p>
          <Button asChild className="mt-2">
            <Link href="/upload">
              <Plus />
              Upload a cat
            </Link>
          </Button>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((cat) => (
            <CatCard key={cat.id} cat={cat} />
          ))}
        </section>
      )}
    </main>
  );
}
