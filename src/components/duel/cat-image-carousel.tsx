"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import type { PairImage } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const FIRST_INDEX = 0;
const SINGLE = 1;

const ARROW_CLASS =
  "absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-card text-foreground opacity-0 shadow-sticker-press transition-[opacity,transform] duration-150 hover:scale-110 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100";

type CatImageCarouselProps = {
  name: string;
  images: PairImage[];
  className?: string;
};

export function CatImageCarousel({ name, images, className }: CatImageCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(FIRST_INDEX);

  const count = images.length;
  const hasMany = count > SINGLE;

  useEffect(() => {
    if (!emblaApi) {
      return;
    }
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  if (count === 0) {
    return null;
  }

  return (
    <section
      className={cn("group relative size-full overflow-hidden bg-muted", className)}
      aria-roledescription="carousel"
      aria-label={`${name} photos`}
    >
      <div className="size-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {images.map((image, index) => (
            // biome-ignore lint/a11y/useSemanticElements: WAI-ARIA carousel "slide" pattern (role=group + aria-roledescription); <fieldset> is semantically wrong here
            <div
              key={image.position}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + SINGLE} of ${count}`}
              className="relative h-full min-w-0 shrink-0 grow-0 basis-full"
            >
              {/* biome-ignore lint/performance/noImgElement: R2/CDN duel image; next/image optimization is a phase-08 (CWV) follow-up */}
              <img
                src={image.url}
                alt={`${name} (${index + SINGLE} of ${count})`}
                width={image.width}
                height={image.height}
                className="size-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {hasMany ? (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => emblaApi?.scrollPrev()}
            className={cn(ARROW_CLASS, "left-2.5")}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => emblaApi?.scrollNext()}
            className={cn(ARROW_CLASS, "right-2.5")}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {images.map((image, index) => (
              <button
                key={image.position}
                type="button"
                aria-label={`Go to photo ${index + SINGLE}`}
                aria-current={index === selected}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  "h-1.5 rounded-full border border-ink transition-all",
                  index === selected ? "w-4 bg-card" : "w-1.5 bg-white/70",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
