import { CatPhotoAlbum } from "@/components/cat/cat-photo-album";
import type { CatPage } from "@/data/cat-page";

const FIRST_PHOTO_NUMBER = 1;

type CatDetailProps = {
  cat: CatPage;
};

export function CatDetail({ cat }: CatDetailProps) {
  const photos = cat.images.map((img, index) => ({
    src: img.url,
    width: img.width,
    height: img.height,
    alt: `${cat.name} — photo ${index + FIRST_PHOTO_NUMBER}`,
  }));

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <header>
        <h1 className="font-display font-bold text-3xl">{cat.name}</h1>
        <p className="text-muted-foreground">
          Leaderboard rank: <span className="font-semibold text-foreground">#{cat.rank}</span>
        </p>
      </header>

      <section aria-label={`Photos of ${cat.name}`}>
        <CatPhotoAlbum catName={cat.name} photos={photos} />
      </section>

      <section aria-label="Rating">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-sm">Rating</dt>
            <dd className="font-semibold">{Math.round(cat.rating)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Score</dt>
            <dd className="font-semibold">{Math.round(cat.score)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Wins</dt>
            <dd className="font-semibold">{cat.wins}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Losses</dt>
            <dd className="font-semibold">{cat.losses}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Recent duels">
        <h2 className="mb-2 font-display font-semibold text-xl">Recent duels</h2>
        {cat.recentDuels.length === 0 ? (
          <p className="text-muted-foreground">No duels yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {cat.recentDuels.map((duel) => (
              <li key={duel.id}>{duel.won ? "Won" : "Lost"}</li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
