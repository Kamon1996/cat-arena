"use client";

import { Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Mimo } from "@/components/brand/mimo";
import { CatCard, type DuelCardState } from "@/components/duel/cat-card";
import { DuelSkeleton } from "@/components/duel/duel-skeleton";
import { SkipButton } from "@/components/duel/skip-button";
import { type Celebration, VoteCelebration } from "@/components/duel/vote-celebration";
import { VsBadge } from "@/components/duel/vs-badge";
import { Button } from "@/components/ui/button";
import { catToast } from "@/components/ui/cat-toast";
import { usePairQueue } from "@/hooks/use-pair-queue";
import { useSubmitVote } from "@/hooks/use-submit-vote";

const CELEBRATION_MS = 1150;
const EXIT_DURATION_S = 0.2;

type DuelArenaProps = {
  scope?: string;
};

export function DuelArena({ scope = "global" }: DuelArenaProps) {
  const { current, isPending, isError, advance, retry } = usePairQueue(scope);
  const vote = useSubmitVote();
  const [pendingWinnerId, setPendingWinnerId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const celebrationId = useRef(0);
  const advanceTimerRef = useRef<number | null>(null);
  const currentTokenRef = useRef<string | null>(null);

  useEffect(() => {
    currentTokenRef.current = current?.token ?? null;
  }, [current]);

  // Don't advance after unmount: the celebration timer would otherwise fire
  // into the dead hook and kick off a pointless background fetch.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const busy = vote.isPending || pendingWinnerId !== null;

  const handlePick = (winnerCatId: string, origin: { x: number; y: number }) => {
    if (!current || busy) {
      return;
    }
    // AnimatePresence keeps the outgoing pair mounted (frozen props) for its
    // exit animation — ignore clicks on a card that is no longer the live pair.
    if (current.token !== currentTokenRef.current) {
      return;
    }
    // The pair token died while the tab sat open; submitting would be a
    // guaranteed 403 — swap in a fresh pair instead.
    if (current.expiresAt <= Date.now()) {
      advance();
      return;
    }
    const loserCatId = winnerCatId === current.a.id ? current.b.id : current.a.id;
    const winnerName = winnerCatId === current.a.id ? current.a.name : current.b.name;

    setPendingWinnerId(winnerCatId);
    celebrationId.current += 1;
    setCelebration({ id: celebrationId.current, x: origin.x, y: origin.y, name: winnerName });

    vote.mutate(
      { token: current.token, winnerCatId, loserCatId },
      {
        onError: () => {
          // The vote didn't land — keep the pair on screen so "try again" is
          // actually possible: cancel the scheduled advance and tear down the
          // optimistic celebration before surfacing the error.
          clearAdvanceTimer();
          setPendingWinnerId(null);
          setCelebration(null);
          catToast.error("That vote didn't count", { message: "Give it another try." });
        },
      },
    );

    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      setPendingWinnerId(null);
      setCelebration(null);
      advance(); // the next pair is already in memory — no network wait
    }, CELEBRATION_MS);
  };

  const handleSkip = () => {
    if (busy) {
      return;
    }
    advance();
  };

  if (isPending) {
    return <DuelSkeleton />;
  }

  if (isError || !current) {
    return <DuelEmpty onRetry={retry} />;
  }

  const stateFor = (catId: string): DuelCardState =>
    pendingWinnerId === null ? "idle" : catId === pendingWinnerId ? "win" : "lose";

  return (
    <div className="flex w-full flex-col items-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.token}
          exit={{
            opacity: 0,
            pointerEvents: "none",
            transition: { duration: EXIT_DURATION_S },
          }}
          className="flex w-full max-w-220 items-stretch justify-center gap-3 max-sm:flex-col max-sm:items-center sm:gap-6"
        >
          <CatCard
            cat={current.a}
            side="a"
            state={stateFor(current.a.id)}
            disabled={busy}
            onPick={handlePick}
          />
          <VsBadge />
          <CatCard
            cat={current.b}
            side="b"
            state={stateFor(current.b.id)}
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
