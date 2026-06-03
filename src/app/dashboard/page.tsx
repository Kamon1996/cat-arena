import { requireUser } from "@/auth/guards";
import type { CatCardData } from "@/components/dashboard/cat-card";
import { CatCard } from "@/components/dashboard/cat-card";
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
    <main>
      <h1>My cats</h1>
      {atLimit ? null : <a href="/upload">Add a cat</a>}
      {cards.length === 0 ? (
        <p>
          You have no cats yet. <a href="/upload">Upload your first cat</a>.
        </p>
      ) : (
        <section>
          {cards.map((cat) => (
            <CatCard key={cat.id} cat={cat} />
          ))}
        </section>
      )}
    </main>
  );
}
