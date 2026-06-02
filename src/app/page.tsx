import type { Metadata } from "next";
import Link from "next/link";

import { DuelArena } from "@/components/duel/duel-arena";

export const metadata: Metadata = {
  title: "Vote on cats",
  description: "Pick the better of two cats in a 1-vs-1 duel and see them climb the leaderboard.",
};

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 py-10">
      <h1 className="font-bold text-2xl">Which cat is better?</h1>
      <DuelArena scope="global" />
      <nav aria-label="Site sections">
        <Link href="/top" className="underline">
          See the top cats leaderboard
        </Link>
      </nav>
    </main>
  );
}
