"use client";

import { CatImageCarousel } from "@/components/duel/cat-image-carousel";
import { VoteButton } from "@/components/duel/vote-button";
import type { PairCat } from "@/lib/api-types";

type CatCardProps = {
  cat: PairCat;
  onPick: (catId: string) => void;
  disabled: boolean;
};

export function CatCard({ cat, onPick, disabled }: CatCardProps) {
  return (
    <div className="flex w-full flex-col gap-3">
      <CatImageCarousel name={cat.name} images={cat.images} className="aspect-square" />
      <h2 className="text-center font-semibold text-lg">{cat.name}</h2>
      <VoteButton label={`Pick ${cat.name}`} onVote={() => onPick(cat.id)} disabled={disabled} />
    </div>
  );
}
