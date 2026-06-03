"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { PairImage } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const FIRST_INDEX = 0;
const STEP = 1;

type CatImageCarouselProps = {
  name: string;
  images: PairImage[];
  className?: string;
};

export function CatImageCarousel({ name, images, className }: CatImageCarouselProps) {
  const [index, setIndex] = useState(FIRST_INDEX);
  const count = images.length;
  const current = images[index] ?? images[FIRST_INDEX];
  const hasMany = count > STEP;

  const go = (delta: number) => setIndex((prev) => (prev + delta + count) % count);

  if (!current) {
    return null;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* biome-ignore lint/performance/noImgElement: R2/CDN duel image; next/image optimization is a phase-08 (CWV) follow-up */}
      <img
        src={current.url}
        alt={`${name} (${index + STEP} of ${count})`}
        width={current.width}
        height={current.height}
        className="h-full w-full object-cover"
      />
      {hasMany ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(event) => {
              event.stopPropagation();
              go(-STEP);
            }}
            className="-translate-y-1/2 absolute top-1/2 left-2 rounded-full bg-black/50 p-1 text-white"
          >
            <ChevronLeft aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(event) => {
              event.stopPropagation();
              go(STEP);
            }}
            className="-translate-y-1/2 absolute top-1/2 right-2 rounded-full bg-black/50 p-1 text-white"
          >
            <ChevronRight aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  );
}
