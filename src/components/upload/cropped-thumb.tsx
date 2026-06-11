"use client";

import { useState } from "react";

import type { CropAreaPixels } from "@/components/upload/crop-dialog";
import { cn } from "@/lib/utils";

const PERCENT = 100;

type CroppedThumbProps = {
  src: string;
  /** Duel framing; null shows the photo as-is (object-cover). */
  crop: CropAreaPixels | null;
  alt: string;
  className?: string;
};

type Measured = { forSrc: string; width: number; height: number };

/**
 * Preview that shows the photo THROUGH its duel framing — pure CSS, no canvas:
 * the img is scaled and offset so the crop rect exactly fills the box. The
 * actual crop happens server-side; this only mirrors what voters will see.
 */
export function CroppedThumb({ src, crop, alt, className }: CroppedThumbProps) {
  // Natural dims of the decoded photo — needed to convert the pixel rect into
  // percentages of the box. The measurement is keyed to the src it was taken
  // from, so a swapped photo never renders with stale geometry.
  const [measured, setMeasured] = useState<Measured | null>(null);
  const natural = measured && measured.forSrc === src ? measured : null;

  if (!crop) {
    // biome-ignore lint/performance/noImgElement: local object-URL blob preview, not a remote asset
    return <img src={src} alt={alt} className={cn("size-full object-cover", className)} />;
  }

  return (
    <span className={cn("relative block size-full overflow-hidden", className)}>
      {/* biome-ignore lint/performance/noImgElement: local object-URL blob preview, not a remote asset */}
      <img
        src={src}
        alt={alt}
        onLoad={(event) => {
          const img = event.currentTarget;
          setMeasured({ forSrc: src, width: img.naturalWidth, height: img.naturalHeight });
        }}
        className={cn("absolute max-w-none", natural ? "opacity-100" : "opacity-0")}
        style={
          natural
            ? {
                width: `${(natural.width / crop.width) * PERCENT}%`,
                height: `${(natural.height / crop.height) * PERCENT}%`,
                left: `${(-crop.x / crop.width) * PERCENT}%`,
                top: `${(-crop.y / crop.height) * PERCENT}%`,
              }
            : undefined
        }
      />
    </span>
  );
}
