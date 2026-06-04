"use client";

import { Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Mimo } from "@/components/brand/mimo";
import { CatCard, type DuelCardState } from "@/components/duel/cat-card";
import { DuelSkeleton } from "@/components/duel/duel-skeleton";
import { SkipButton } from "@/components/duel/skip-button";
import { type Celebration, VoteCelebration } from "@/components/duel/vote-celebration";
import { VsBadge } from "@/components/duel/vs-badge";
import { Button } from "@/components/ui/button";
import { catToast } from "@/components/ui/cat-toast";
import { useNextPair } from "@/hooks/use-next-pair";
import { useSubmitVote } from "@/hooks/use-submit-vote";

const CELEBRATION_MS = 1150;
const EXIT_DURATION_S = 0.2;

type DuelArenaProps = {
  scope?: string;
};

export function DuelArena({ scope = "global" }: DuelArenaProps) {
  const { data, isPending, isError, refetch } = useNextPair(scope);
  const vote = useSubmitVote();
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const celebrationId = useRef(0);

  const busy = vote.isPending || pendingWinnerId !== null;

  const handlePick = (winnerCatId: string, origin: { x: number; y: number }) => {
    if (!data || busy) {
      return;
    }
    const loserCatId = winnerCatId === data.a.id ? data.b.id : data.a.id;
    const winnerName = winnerCatId === data.a.id ? data.a.name : data.b.name;

    setPendingWinnerId(winnerCatId);
    celebrationId.current += 1;
    setCelebration({ id: celebrationId.current, x: origin.x, y: origin.y, name: winnerName });

    vote.mutate(
      { token: data.token, winnerCatId, loserCatId },
      {
        onError: () => {
          // The vote didn't land — tear down the optimistic celebration so it
          // can't play alongside the failure, and surface the error instead.
          setPendingWinnerId(null);
          setCelebration(null);
          catToast.error("That vote didn't count", { message: "Give it another try." });
        },
      },
    );

    window.setTimeout(() => {
      setPendingWinnerId(null);
      setCelebration(null);
      void refetch();
    }, CELEBRATION_MS);
  };

  const handleSkip = () => {
    if (busy) {
      return;
    }
    void refetch();
  };

  if (isPending) {
    return <DuelSkeleton />;
  }

  if (isError || !data) {
    return <DuelEmpty onRetry={() => void refetch()} />;
  }

  const stateFor = (catId: string): DuelCardState =>
    pendingWinnerId === null ? "idle" : catId === pendingWinnerId ? "win" : "lose";

  return (
    <div className="flex w-full flex-col items-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={data.token}
          exit={{ opacity: 0, transition: { duration: EXIT_DURATION_S } }}
          className="flex w-full max-w-220 items-stretch justify-center gap-3 max-sm:flex-col max-sm:items-center sm:gap-6"
        >
          <CatCard
            cat={data.a}
            side="a"
            state={stateFor(data.a.id)}
            disabled={busy}
            onPick={handlePick}
          />
          <VsBadge />
          <CatCard
            cat={data.b}
            side="b"
            state={stateFor(data.b.id)}
            disabled={busy}
            onPick={handlePick}
          />
        </motion.div>
      </AnimatePresence>

      <div className="mt-7 flex flex-col items-center gap-2.5">
        <SkipButton onSkip={handleSkip} disabled={busy} />
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          No scores shown — vote on the cat, not the number
        </span>
      </div>

      <VoteCelebration celebration={celebration} />
    </div>
  );
}

function DuelEmpty({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <Mimo mood="sleepy" className="size-36" />
      <h2 className="font-display text-3xl font-bold">No cats to compare right now</h2>
      <p className="max-w-sm text-muted-foreground">
        The arena is napping. Be the first — upload your cat, then come back to vote.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/upload">Upload a cat</Link>
        </Button>
        <Button variant="outline" type="button" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
