"use client";

import { type CSSProperties, useState } from "react";

import { PhotoLightbox } from "@/components/dashboard/photo-lightbox";
import { cn } from "@/lib/utils";
import type { ModerationImage } from "@/moderation/moderation-types";

export type PhotoGridLayout = "fill" | "responsive" | "square" | "compact";

const MAX_FILL_COLUMNS = 4;
// Stage aspect when the loader has no dims (legacy rows) — a neutral square.
const FALLBACK_EDGE = 1;

/**
 * Photo layouts for a moderation row:
 * - fill:       equal columns that stretch to the full width (large on wide rows).
 * - responsive: auto-fill tiles capped at ~15rem, wrap + left-align (the default).
 * - square:     uniform square thumbnails, auto-fill capped at ~11rem.
 * - compact:    small fixed 6rem thumbnails, flex-wrapped.
 */
const LAYOUTS: Record<PhotoGridLayout, { container: string; tile: string }> = {
  fill: { container: "grid gap-2.5", tile: "h-[150px]" },
  responsive: {
    container: "grid grid-cols-[repeat(auto-fill,minmax(11rem,15rem))] gap-2.5",
    tile: "h-40",
  },
  square: {
    container: "grid grid-cols-[repeat(auto-fill,minmax(8.5rem,11rem))] gap-2.5",
    tile: "aspect-square",
  },
  compact: { container: "flex flex-wrap gap-2", tile: "size-24" },
};

interface ModerationPhotoGridProps {
  images: ModerationImage[];
  catName: string;
  layout?: PhotoGridLayout;
  className?: string;
}

export function ModerationPhotoGrid({
  images,
  catName,
  layout = "responsive",
  className,
}: ModerationPhotoGridProps) {
  // Index of the photo opened fullscreen; null = lightbox closed.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const { container, tile } = LAYOUTS[layout];
  const containerStyle: CSSProperties | undefined =
    layout === "fill"
      ? {
          gridTemplateColumns: `repeat(${Math.min(images.length, MAX_FILL_COLUMNS)}, minmax(0, 1fr))`,
        }
      : undefined;

  // The lightbox shows the UNCROPPED full variant — the tiles are the cropped
  // duel framing, but a moderation verdict must be made on the whole photo.
  const lightboxPhotos = images.map((image) => ({
    url: image.fullUrl,
    thumbUrl: image.thumbUrl,
    width: image.width ?? FALLBACK_EDGE,
    height: image.height ?? FALLBACK_EDGE,
  }));

  return (
    <>
      <ul className={cn(container, className)} style={containerStyle}>
        {images.map((image, i) => (
          <li
            key={image.id}
            className={cn("relative overflow-hidden rounded-md border-2 border-ink bg-muted", tile)}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`${catName} — submission ${i + 1} of ${images.length}, view the full photo`}
              className="block size-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              {/* biome-ignore lint/performance/noImgElement: R2/CDN thumbnail, not a local asset */}
              <img src={image.thumbUrl} alt="" className="size-full object-cover" />
            </button>
            {image.width && image.height && layout !== "compact" ? (
              <span className="pointer-events-none absolute right-2 bottom-2 rounded-md border border-border bg-card/90 px-1.5 py-0.5 font-mono text-[0.625rem]">
                {image.width}×{image.height}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <PhotoLightbox
        catName={catName}
        photos={lightboxPhotos}
        openIndex={openIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
