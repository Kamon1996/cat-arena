import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { ModerationImage } from "@/moderation/moderation-types";

export type PhotoGridLayout = "fill" | "responsive" | "square" | "compact";

const MAX_FILL_COLUMNS = 4;

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
  const { container, tile } = LAYOUTS[layout];
  const containerStyle: CSSProperties | undefined =
    layout === "fill"
      ? {
          gridTemplateColumns: `repeat(${Math.min(images.length, MAX_FILL_COLUMNS)}, minmax(0, 1fr))`,
        }
      : undefined;

  return (
    <ul className={cn(container, className)} style={containerStyle}>
      {images.map((image, i) => (
        <li
          key={image.id}
          className={cn("relative overflow-hidden rounded-md border-2 border-ink bg-muted", tile)}
        >
          {/* biome-ignore lint/performance/noImgElement: R2/CDN thumbnail, not a local asset */}
          <img
            src={image.thumbUrl}
            alt={`${catName} — submission ${i + 1} of ${images.length}`}
            className="size-full object-cover"
          />
          {image.width && image.height && layout !== "compact" ? (
            <span className="absolute right-2 bottom-2 rounded-md border border-border bg-card/90 px-1.5 py-0.5 font-mono text-[0.625rem]">
              {image.width}×{image.height}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
