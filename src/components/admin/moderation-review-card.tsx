"use client";

import { Check, ChevronLeft, X, ZoomIn } from "lucide-react";
import { useState } from "react";

import { Mimo } from "@/components/brand/mimo";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { cn } from "@/lib/utils";
import { REJECTION_REASONS } from "@/moderation/moderation-types";

export interface ReviewImage {
  /** Image URL; falls back to a placeholder when absent. */
  url?: string;
  /** Original filename, shown as a chip. */
  filename?: string;
  /** "1080×1350" etc., shown as a chip. */
  dimensions?: string;
}

export interface ModerationReviewCardProps {
  catName: string;
  /** Submitter line, e.g. "Aiko Tanaka · @mochi.meow · 2 min ago". */
  submittedBy?: string;
  images: ReviewImage[];
  /** Position in the review queue (e.g. 12 of 248). */
  queuePosition?: number;
  queueTotal?: number;
  /** Selectable flags; defaults to REJECTION_REASONS. */
  flags?: readonly string[];
  onApprove?: () => void;
  onReject?: (selectedFlags: string[]) => void;
  onBack?: () => void;
  onZoom?: (imageIndex: number) => void;
  className?: string;
}

/**
 * Mobile moderation review screen: one photo at a time with flag chips and
 * sticky Approve / Reject actions (Reject unlocks once ≥1 flag is set). Fills
 * its container's height; drop it into a phone-width column.
 */
export function ModerationReviewCard({
  catName,
  submittedBy,
  images,
  queuePosition,
  queueTotal,
  flags = REJECTION_REASONS,
  onApprove,
  onReject,
  onBack,
  onZoom,
  className,
}: ModerationReviewCardProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  const current = images[activeImage] ?? images[0];
  const issueCount = selected.length;
  const rejectLabel =
    issueCount === 0 ? "Reject" : `Reject · ${issueCount} issue${issueCount === 1 ? "" : "s"}`;

  const toggleFlag = (flag: string) => {
    setSelected((prev) => (prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]));
  };

  return (
    <div className={cn("flex h-full flex-col bg-background text-foreground", className)}>
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Button type="button" variant="outline" size="icon-sm" aria-label="Back" onClick={onBack}>
          <ChevronLeft />
        </Button>
        <h1 className="font-display font-bold text-xl">Review</h1>
        {queuePosition && queueTotal ? (
          <span className="ml-auto inline-flex items-center rounded-full border border-border bg-muted px-3 py-1.5 font-semibold text-xs tabular-nums">
            {queuePosition} / {queueTotal}
          </span>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-lg border-2 border-ink bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))]">
          {current?.url ? (
            // biome-ignore lint/performance/noImgElement: R2/CDN review image, not a local asset
            <img
              src={current.url}
              alt={`${catName} submission`}
              className="size-full object-cover"
            />
          ) : (
            <Mimo mood="sleepy" className="size-2/5 opacity-30" />
          )}
          {current?.filename ? (
            <span className="absolute top-2.5 left-2.5 rounded-md bg-foreground/80 px-2 py-1 font-mono text-[0.6875rem] text-background">
              {current.filename}
            </span>
          ) : null}
          {current?.dimensions ? (
            <span className="absolute right-2.5 bottom-2.5 rounded-md border border-border bg-card/90 px-2 py-1 font-mono text-[0.6875rem]">
              {current.dimensions}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="absolute bottom-2.5 left-2.5"
            onClick={() => onZoom?.(activeImage)}
          >
            <ZoomIn />
            Full size
          </Button>
        </div>

        {images.length > 1 ? (
          <div className="mt-3 flex justify-center gap-1.5">
            {images.map((image, i) => (
              <button
                key={image.url ?? image.filename ?? i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                aria-current={i === activeImage ? "true" : undefined}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === activeImage ? "w-5 bg-primary" : "w-2 bg-border",
                )}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-sm border-2 border-ink bg-primary font-display font-bold text-lg text-primary-foreground">
            {catName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="font-display font-semibold text-xl leading-tight">{catName}</div>
            {submittedBy ? (
              <div className="mt-0.5 truncate text-muted-foreground text-sm">{submittedBy}</div>
            ) : null}
          </div>
        </div>

        <fieldset className="mt-6 border-0 p-0">
          <legend className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            Flag issues
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {flags.map((flag) => (
              <ToggleChip
                key={flag}
                pressed={selected.includes(flag)}
                onClick={() => toggleFlag(flag)}
              >
                {flag}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="sticky bottom-0 flex gap-3 border-border border-t-2 bg-gradient-to-t from-background from-80% to-transparent px-4 py-4">
        <Button
          type="button"
          variant="destructive"
          size="lg"
          className="flex-1"
          disabled={issueCount === 0}
          onClick={() => onReject?.(selected)}
        >
          <X aria-hidden />
          {rejectLabel}
        </Button>
        <Button type="button" size="lg" className="flex-1" onClick={onApprove}>
          <Check aria-hidden />
          Approve
        </Button>
      </div>
    </div>
  );
}
