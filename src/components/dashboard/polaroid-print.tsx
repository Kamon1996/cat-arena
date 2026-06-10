"use client";

import { cva } from "class-variance-authority";
import { Camera, Info, X, ZoomIn } from "lucide-react";
import type { MouseEvent } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type PolaroidPhoto = {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  /** Intrinsic dims of the (rotation-baked) original — the lightbox reserves
   *  the exact frame size from these before the full image loads. */
  width: number;
  height: number;
  status: string; // APPROVED | PENDING | REJECTED
  rejectionReasons: string[];
};

/** Photo-booth caption text + tint per image moderation status. */
export const PHOTO_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  PENDING: "In review",
  REJECTED: "Rejected",
};

export const PHOTO_STATUS_TEXT_CLASS: Record<string, string> = {
  APPROVED: "text-[color-mix(in_srgb,var(--success)_58%,var(--foreground))]",
  PENDING: "text-[color-mix(in_srgb,var(--warning)_60%,var(--foreground))]",
  REJECTED: "text-destructive",
};

const DEFAULT_REJECTION_REASON = "Rejected by moderator.";

// Grainy rubber-stamp texture (SVG turbulence noise) for the REJECTED mark.
const STAMP_GRAIN_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .9 .12'/%3E%3C/filter%3E%3Crect width='80' height='80' fill='%23000' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** The print "hangs" tilted by its slot; hover straightens, lifts and fronts it. */
const polaroidVariants = cva(
  [
    "group relative w-37 shrink-0 rounded-[4px] bg-white p-2 pb-7.5",
    "border-[1.5px] border-[color-mix(in_srgb,var(--border-ink)_55%,transparent)]",
    "shadow-[0_6px_16px_-4px_rgba(25,23,28,.28),0_1px_3px_rgba(25,23,28,.18)]",
    // v4 gotcha: rotate/scale/translate utilities are individual CSS properties,
    // NOT `transform` — they must be listed explicitly to animate on hover.
    "transition-[translate,scale,rotate,box-shadow] duration-200 ease-spring",
    "hover:z-8 hover:-translate-y-0.5 hover:rotate-0 hover:scale-105",
    "hover:shadow-[0_14px_28px_-6px_rgba(25,23,28,.35),0_2px_5px_rgba(25,23,28,.2)]",
    "motion-reduce:transition-none",
  ],
  {
    variants: {
      slot: {
        0: "z-1 translate-y-1.75 rotate-[-5deg]",
        1: "z-2 -translate-y-1 rotate-[2.5deg]",
        2: "z-1 translate-y-2.25 rotate-[5deg]",
      },
    },
    defaultVariants: { slot: 0 },
  },
);

/** Push-pin; color cycles teal → pink → tangerine by photo index. */
const pinVariants = cva(
  [
    "absolute -top-2.25 left-1/2 z-6 size-5.5 -translate-x-1/2 rounded-full border-2 border-ink",
    "shadow-[inset_-2px_-3px_0_rgba(25,23,28,.22),0_3px_0_-1px_var(--border-ink),0_5px_6px_rgba(25,23,28,.3)]",
    "after:absolute after:left-1 after:top-0.75 after:h-1.25 after:w-1.5 after:rotate-[-20deg] after:rounded-full after:bg-white/75 after:content-['']",
  ],
  {
    variants: {
      tone: {
        teal: "bg-primary",
        pink: "bg-accent",
        tang: "bg-secondary",
      },
    },
    defaultVariants: { tone: "teal" },
  },
);

const photoImgVariants = cva("block aspect-square w-full object-cover", {
  variants: {
    status: {
      APPROVED: "",
      PENDING: "saturate-[.92]",
      REJECTED: "opacity-55 grayscale-[.9] contrast-[.92]",
    },
  },
  defaultVariants: { status: "APPROVED" },
});

export const PIN_TONES = ["teal", "pink", "tang"] as const;

export function pinToneFor(index: number): (typeof PIN_TONES)[number] {
  return PIN_TONES[index % PIN_TONES.length] ?? "teal";
}

export function slotFor(index: number): 0 | 1 | 2 {
  return (index % 3) as 0 | 1 | 2;
}

type PolaroidPrintProps = {
  photo: PolaroidPhoto;
  index: number;
  busy?: boolean;
  /** Banned cat: the print is view-only (no remove / replace). */
  readOnly?: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onReplace: () => void;
};

export function PolaroidPrint({
  photo,
  index,
  busy,
  readOnly,
  onOpen,
  onRemove,
  onReplace,
}: PolaroidPrintProps) {
  const rejected = photo.status === "REJECTED";
  const statusKey = (
    photo.status in PHOTO_STATUS_LABEL ? photo.status : "PENDING"
  ) as keyof typeof PHOTO_STATUS_LABEL & ("APPROVED" | "PENDING" | "REJECTED");
  const reason =
    photo.rejectionReasons.length > 0
      ? photo.rejectionReasons.join(" · ")
      : DEFAULT_REJECTION_REASON;

  const handleReplace = (event: MouseEvent) => {
    event.stopPropagation(); // Replace must not open the lightbox underneath
    onReplace();
  };

  return (
    <div className={polaroidVariants({ slot: slotFor(index) })} data-status={photo.status}>
      <span className={pinVariants({ tone: pinToneFor(index) })} aria-hidden />

      {readOnly ? null : (
        <button
          type="button"
          aria-label="Remove this photo"
          disabled={busy}
          onClick={onRemove}
          className={cn(
            "absolute -top-2 -right-2 z-7 grid size-5.5 scale-75 place-items-center rounded-full",
            "border-2 border-ink bg-card text-foreground opacity-0 shadow-[1.5px_1.5px_0_var(--border-ink)]",
            "transition-[opacity,scale,background-color,color] duration-150 ease-spring",
            "group-hover:scale-100 group-hover:opacity-100 focus-visible:scale-100 focus-visible:opacity-100",
            "hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40",
          )}
        >
          <X className="size-2.5" strokeWidth={4} aria-hidden />
        </button>
      )}

      <button
        type="button"
        title="View original"
        onClick={onOpen}
        className="relative block w-full cursor-zoom-in overflow-hidden rounded-[2px] bg-muted"
      >
        {/* biome-ignore lint/performance/noImgElement: R2/CDN thumbnail, not a local asset */}
        <img src={photo.thumbUrl} alt="" className={photoImgVariants({ status: statusKey })} />

        {/* Zoom affordance — the whole print is clickable, the lens is just a hint. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 z-5 grid size-9 place-items-center rounded-full",
            "-translate-x-1/2 -translate-y-1/2 scale-[.6] border-2 border-ink bg-card text-foreground",
            "opacity-0 shadow-[2px_2px_0_var(--border-ink)]",
            "transition-[opacity,scale] duration-150 ease-spring",
            "group-hover:scale-100 group-hover:opacity-100",
          )}
        >
          <ZoomIn className="size-4" aria-hidden />
        </span>

        {rejected ? (
          <span
            aria-hidden
            style={{ maskImage: STAMP_GRAIN_MASK, WebkitMaskImage: STAMP_GRAIN_MASK }}
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 z-4 whitespace-nowrap",
              "-translate-x-1/2 -translate-y-1/2 -rotate-[14deg] rounded-md border-[2.5px] border-current",
              "px-2.5 py-1 font-display text-sm font-bold tracking-[.1em] text-destructive uppercase",
            )}
          >
            Rejected
          </span>
        ) : null}
      </button>

      {rejected && !readOnly ? (
        <button
          type="button"
          disabled={busy}
          onClick={handleReplace}
          className={cn(
            "absolute bottom-2 left-1/2 z-5 inline-flex -translate-x-1/2 items-center gap-1.5",
            "rounded-full border-2 border-ink bg-card px-2.5 py-1 font-display text-[11px] font-bold",
            "whitespace-nowrap text-foreground shadow-sticker-press",
            "transition-transform duration-150 hover:-translate-x-1/2 hover:scale-105 disabled:opacity-40",
          )}
        >
          <Camera className="size-3" aria-hidden />
          Replace
        </button>
      ) : null}

      <div className="absolute right-2.5 bottom-1.75 left-2.5 flex items-baseline justify-between text-[10.5px] font-semibold tracking-wider uppercase">
        <span className="font-bold text-[color-mix(in_srgb,var(--foreground)_35%,transparent)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        {rejected ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex cursor-help items-center gap-1",
                    PHOTO_STATUS_TEXT_CLASS.REJECTED,
                  )}
                >
                  {PHOTO_STATUS_LABEL.REJECTED}
                  <Info className="size-2.5 opacity-80" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-44 text-left normal-case">{reason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className={PHOTO_STATUS_TEXT_CLASS[statusKey]}>
            {PHOTO_STATUS_LABEL[statusKey]}
          </span>
        )}
      </div>
    </div>
  );
}
