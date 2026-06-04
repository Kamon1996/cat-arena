import type { Metadata } from "next";

import { DuelArena } from "@/components/duel/duel-arena";

export const metadata: Metadata = {
  title: "Vote on cats",
  description: "Pick the cuter of two cats in a 1-vs-1 duel and watch them climb the leaderboard.",
};

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--accent) 26%, transparent) 2px, transparent 2px)",
          backgroundSize: "30px 30px",
        }}
      />
      <div className="relative z-10 flex w-full flex-col items-center">
        <h1 className="text-center font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Who's the <span className="text-accent">better</span> cat?
        </h1>
        <p className="mt-2 mb-7 text-center text-muted-foreground">
          Tap the cuter cat. Every vote is anonymous and instant.
        </p>
        <DuelArena scope="global" />
      </div>
      <p className="relative z-10 mt-10 text-center text-sm text-muted-foreground">
        Powered by Glicko-2
      </p>
    </main>
  );
}
