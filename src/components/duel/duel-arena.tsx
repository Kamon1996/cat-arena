"use client";

import { AnimatePresence, motion } from "motion/react";

import { CatCard } from "@/components/duel/cat-card";
import { SkipButton } from "@/components/duel/skip-button";
import { useNextPair } from "@/hooks/use-next-pair";
import { useSubmitVote } from "@/hooks/use-submit-vote";

const ENTER_DURATION_S = 0.25;
const PAIR_OFFSET_PX = 16;

const pairTransition = {
  type: "tween" as const,
  ease: "easeOut" as const,
  duration: ENTER_DURATION_S,
};

type DuelArenaProps = {
  scope?: string;
};

export function DuelArena({ scope = "global" }: DuelArenaProps) {
  const { data, isPending, isError, refetch } = useNextPair(scope);
  const vote = useSubmitVote();
  const busy = vote.isPending;

  const handlePick = (winnerCatId: string) => {
    if (!data || busy) {
      return;
    }
    const loserCatId = winnerCatId === data.a.id ? data.b.id : data.a.id;
    vote.mutate({ token: data.token, winnerCatId, loserCatId });
  };

  const handleSkip = () => {
    if (busy) {
      return;
    }
    void refetch();
  };

  if (isPending) {
    return <p role="status">Loading cats…</p>;
  }
  if (isError || !data) {
    return <p role="alert">No cats to compare right now. Please try again shortly.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={data.token}
          initial={{ opacity: 0, y: PAIR_OFFSET_PX }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -PAIR_OFFSET_PX }}
          transition={pairTransition}
          className="grid w-full max-w-3xl grid-cols-2 gap-4"
        >
          <CatCard cat={data.a} onPick={handlePick} disabled={busy} />
          <CatCard cat={data.b} onPick={handlePick} disabled={busy} />
        </motion.div>
      </AnimatePresence>
      <SkipButton onSkip={handleSkip} disabled={busy} />
    </div>
  );
}
