"use client";

import { motion, type Transition } from "motion/react";
import { useRef } from "react";

import { CatImageCarousel } from "@/components/duel/cat-image-carousel";
import { VoteButton } from "@/components/duel/vote-button";
import { Badge } from "@/components/ui/badge";
import type { PairCat } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export type DuelCardState = "idle" | "win" | "lose";

const SPRING: Transition = { type: "spring", stiffness: 260, damping: 20 };
const POP: Transition = { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] };
const STAGGER_S = 0.08;
const ENTER_OFFSET_PX = 40;

type CatCardProps = {
  cat: PairCat;
  side: "a" | "b";
  state: DuelCardState;
  disabled: boolean;
  onPick: (catId: string, origin: { x: number; y: number }) => void;
};

export function CatCard({ cat, side, state, disabled, onPick }: CatCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const handleVote = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    const origin = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    onPick(cat.id, origin);
  };

  const target =
    state === "win"
      ? { opacity: 1, x: 0, scale: [1, 1.06, 1] }
      : state === "lose"
        ? { opacity: 0.45, x: 0, scale: 0.96 }
        : { opacity: 1, x: 0, scale: 1 };

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, x: side === "a" ? -ENTER_OFFSET_PX : ENTER_OFFSET_PX, scale: 0.92 }}
      animate={target}
      transition={
        state === "win"
          ? POP
          : { ...SPRING, delay: state === "idle" && side === "b" ? STAGGER_S : 0 }
      }
      className={cn(
        "relative flex w-full max-w-110 min-w-0 flex-col overflow-hidden rounded-xl border-2 border-ink bg-card shadow-sticker-lg sm:max-w-none sm:flex-1",
        state === "win" && "[outline:4px_solid_var(--delight)]",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden border-b-2 border-ink">
        <Badge variant="solid" className="absolute top-3 left-3 z-10">
          Duel
        </Badge>
        <CatImageCarousel name={cat.name} images={cat.images} />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight">{cat.name}</h2>
        <VoteButton
          label={`Pick ${cat.name}`}
          onVote={handleVote}
          disabled={disabled}
          tone={side}
        />
      </div>
    </motion.div>
  );
}
