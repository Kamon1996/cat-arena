"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useState } from "react";

import { PHOTO_STATUS_LABEL, PHOTO_STATUS_TEXT_CLASS } from "@/components/dashboard/polaroid-print";
import { cn } from "@/lib/utils";

const FIRST_INDEX = 0;
const SINGLE = 1;

export type LightboxPhoto = {
  /** Full-size (card variant) URL — the polaroids show thumbs. */
  url: string;
  /** Tiny variant, already cached by the polaroid grid — the blur-up placeholder. */
  thumbUrl?: string;
  /** Intrinsic dims: the frame reserves its exact final size before load. */
  width: number;
  height: number;
  /** Moderation status badge; omit on public pages (everything shown is approved). */
  status?: string;
};

type PhotoLightboxProps = {
  catName: string;
  photos: LightboxPhoto[];
  /** Index to open at; null keeps the lightbox closed. */
  openIndex: number | null;
  onClose: () => void;
};

const NAV_BUTTON_CLASS = cn(
  "grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-card text-foreground",
  "shadow-[3px_3px_0_var(--border-ink)] transition-[translate,scale,box-shadow] duration-150 ease-spring",
  "hover:-translate-x-px hover:-translate-y-px hover:scale-105",
  "active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--border-ink)]",
);

/**
 * Polaroid-framed carousel of a cat's originals. Opens from any print on the
 * scrapbook card, loops with arrows / dots / ←→ keys, closes on ×, Esc or a
 * click on the dimmed background. A single photo renders without arrows/dots.
 * Radix Dialog supplies the portal (mounted at body — never inside transformed
 * containers), focus trap and Esc handling.
 */
export function PhotoLightbox({ catName, photos, openIndex, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(FIRST_INDEX);
  // EVERY original that has finished loading this session. Once a photo is in
  // here, flipping back to it renders the original instantly — no blur-up
  // placeholder, no fade replay.
  const [loadedUrls, setLoadedUrls] = useState<ReadonlySet<string>>(new Set());

  const markLoaded = useCallback((url: string) => {
    setLoadedUrls((prev) => {
      if (prev.has(url)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  useEffect(() => {
    if (openIndex !== null) {
      setIndex(openIndex);
    }
  }, [openIndex]);

  const open = openIndex !== null && photos.length > 0;
  const photo = photos[Math.min(index, photos.length - 1)];
  const many = photos.length > SINGLE;

  const go = (delta: number) => {
    setIndex((current) => (current + delta + photos.length) % photos.length);
  };

  // Warm the neighbours so flipping shows the original, not the blur-up; once
  // a prefetch finishes, that photo is "loaded" too and skips the blur phase.
  useEffect(() => {
    if (!open || photos.length <= SINGLE) {
      return;
    }
    for (const delta of [-1, 1]) {
      const neighbour = photos[(index + delta + photos.length) % photos.length];
      if (neighbour) {
        const img = new Image();
        img.onload = () => markLoaded(neighbour.url);
        img.src = neighbour.url;
      }
    }
  }, [open, index, photos, markLoaded]);

  if (!photo) {
    return null;
  }

  const loaded = loadedUrls.has(photo.url);

  const statusKey =
    photo.status === undefined
      ? null
      : photo.status in PHOTO_STATUS_LABEL
        ? photo.status
        : "PENDING";

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-60 cursor-zoom-out bg-[rgba(25,23,28,.62)] data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              go(-1);
            }
            if (event.key === "ArrowRight") {
              go(1);
            }
          }}
          onClick={(event) => {
            // Background click closes; clicks on the frame/arrows/dots don't.
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
          className="fixed inset-0 z-60 grid cursor-zoom-out place-items-center p-10 outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            {catName} — photo {index + 1} of {photos.length}
          </DialogPrimitive.Title>

          {/* Arrows are pinned to the VIEWPORT edges, not to the photo: frames
              of different aspect ratios resize in the middle while the nav
              never moves — flipping stays under the cursor. The wrapper span
              owns the centering transform so the button's own hover translate
              doesn't fight it. */}
          {many ? (
            <span className="absolute top-1/2 left-4 z-10 -translate-y-1/2 cursor-default sm:left-8">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => go(-1)}
                className={NAV_BUTTON_CLASS}
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
            </span>
          ) : null}
          {many ? (
            <span className="absolute top-1/2 right-4 z-10 -translate-y-1/2 cursor-default sm:right-8">
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => go(1)}
                className={NAV_BUTTON_CLASS}
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </span>
          ) : null}

          <div className="cursor-default">
            <div className="flex items-center">
              <div
                className={cn(
                  "relative rounded-md border-2 border-ink bg-white p-3.5 pb-11",
                  "shadow-[0_30px_70px_-10px_rgba(0,0,0,.5)]",
                  "data-[state=open]:animate-in data-[state=open]:zoom-in-90 motion-reduce:animate-none",
                  // The frame tilt alternates as you flip through the stack.
                  index % 2 === 1 ? "rotate-[1.2deg]" : "rotate-[-1.2deg]",
                )}
              >
                {/* Blur-up stage: the box reserves the photo's exact final size
                    (aspect from the DB, clamped like the old max-w/max-h), the
                    cached thumb shows instantly underneath with a blur, and the
                    original fades in over it once loaded — no frame jump. */}
                <div
                  className="relative overflow-hidden rounded-[3px] bg-muted"
                  style={{
                    aspectRatio: `${photo.width || 1} / ${photo.height || 1}`,
                    width: `min(72vw, 760px, calc(64vh * ${
                      photo.height > 0 ? photo.width / photo.height : 1
                    }))`,
                  }}
                >
                  {/* The blur placeholder mounts ONLY while this original has
                      never finished loading — once seen, flips render the
                      original instantly with no blur frame and no fade. */}
                  {!loaded && photo.thumbUrl ? (
                    // biome-ignore lint/performance/noImgElement: cached CDN thumb as blur-up placeholder
                    <img
                      src={photo.thumbUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 size-full scale-110 object-cover blur-md"
                    />
                  ) : null}
                  {/* biome-ignore lint/performance/noImgElement: R2/CDN original in a lightbox */}
                  <img
                    key={photo.url}
                    src={photo.url}
                    alt={`${catName} — ${index + 1} of ${photos.length}`}
                    onLoad={() => markLoaded(photo.url)}
                    ref={(img) => {
                      // Cached originals can complete before React attaches onLoad.
                      if (img?.complete && img.naturalWidth > 0) {
                        markLoaded(photo.url);
                      }
                    }}
                    className={cn(
                      "relative size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
                      loaded ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
                <div className="absolute right-4 bottom-3 left-4 flex justify-between text-xs font-semibold tracking-wider text-[color-mix(in_srgb,#19171C_60%,transparent)] uppercase">
                  <span>
                    {catName} · {String(index + 1).padStart(2, "0")} /{" "}
                    {String(photos.length).padStart(2, "0")}
                  </span>
                  {statusKey !== null ? (
                    <span className={PHOTO_STATUS_TEXT_CLASS[statusKey]}>
                      {PHOTO_STATUS_LABEL[statusKey]}
                    </span>
                  ) : null}
                </div>
                <DialogPrimitive.Close
                  aria-label="Close"
                  className={cn(
                    "absolute -top-3 -right-3 grid size-8 place-items-center rounded-full border-2 border-ink",
                    "bg-card text-foreground shadow-[2px_2px_0_var(--border-ink)]",
                    "transition-[scale,background-color,color] duration-150 ease-spring",
                    "hover:scale-110 hover:bg-destructive hover:text-destructive-foreground",
                  )}
                >
                  <X className="size-3.5" strokeWidth={3.5} aria-hidden />
                </DialogPrimitive.Close>
              </div>
            </div>
          </div>

          {/* Dots pinned to the viewport bottom — same reasoning as the arrows. */}
          {many ? (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 cursor-default gap-2">
              {photos.map((_p, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional by design
                  key={i}
                  type="button"
                  aria-label={`Go to photo ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-2.5 rounded-full border-[1.5px] border-[rgba(25,23,28,.5)] transition-[width,background] duration-200",
                    i === index ? "w-6.5 bg-primary" : "w-2.5 bg-white/40",
                  )}
                />
              ))}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
