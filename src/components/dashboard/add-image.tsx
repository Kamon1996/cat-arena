"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { addCatImage } from "@/cats/owner-actions";
import { catToast } from "@/components/ui/cat-toast";
import { type CropAreaPixels, CropDialog } from "@/components/upload/crop-dialog";
import { uploadToR2 } from "@/components/upload/upload-to-r2";
import { ALLOWED_UPLOAD_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type AddImageProps = {
  catId: string;
  remaining: number;
  disabled?: boolean;
  /** Position of this slot on the scrapbook board (tilt + pin color). */
  slotIndex?: number;
};

// Owner-action error codes → human messages (codes come from owner-actions.ts).
const ACTION_ERROR_MESSAGES: Record<string, string> = {
  duplicate_image: "This photo has already been uploaded.",
  image_limit: "Photo limit reached for this cat.",
  too_large: "This photo exceeds the upload size limit.",
  rate_limited: "Too many uploads — try again in a minute.",
};

/** The empty polaroid slot on the scrapbook board. Picked files go through the
 *  same crop dialog as the upload form, then upload to R2 and register
 *  (PENDING) on the cat. */
export function AddImage({ catId, remaining, disabled, slotIndex = 0 }: AddImageProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Picked files wait here for a crop decision, one dialog at a time.
  const [cropQueue, setCropQueue] = useState<File[]>([]);

  if (remaining <= 0) {
    return null;
  }

  function handleFiles(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0 || busy) {
      return;
    }
    const accepted = Array.from(fileList).slice(0, Math.max(0, remaining - cropQueue.length));
    setCropQueue((queue) => [...queue, ...accepted]);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function uploadOne(file: File, crop: CropAreaPixels | null): Promise<void> {
    setBusy(true);
    try {
      const { r2Key } = await uploadToR2(file);
      const result = await addCatImage(catId, r2Key, crop);
      if (!result.ok) {
        throw new Error(result.error);
      }
      catToast.success("Photo pinned up · in review", {
        variant: "mascot",
        message: "We'll approve it before it enters the arena.",
      });
      router.refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      catToast.error("Could not add photo", {
        message: ACTION_ERROR_MESSAGES[raw] ?? (raw || "Please try again."),
      });
    } finally {
      setBusy(false);
    }
  }

  /** Crop decision for the queue head: upload the original with its framing. */
  function acceptPhoto(file: File, crop: CropAreaPixels | null): void {
    setCropQueue((queue) => queue.slice(1));
    void uploadOne(file, crop);
  }

  // Empty polaroid slot on the scrapbook board: dashed print waiting for a
  // photo, pinned and tilted like its neighbours. Click opens the file picker.
  return (
    <label
      className={cn(
        "group relative w-37 shrink-0 cursor-pointer rounded-[4px] p-2 pb-7.5",
        "border-[1.5px] border-[color-mix(in_srgb,var(--border-ink)_55%,transparent)]",
        "bg-[color-mix(in_srgb,var(--muted)_60%,#fff)]",
        "shadow-[0_6px_16px_-4px_rgba(25,23,28,.28),0_1px_3px_rgba(25,23,28,.18)]",
        "transition-[translate,scale,rotate,box-shadow] duration-200 ease-spring",
        "hover:z-8 hover:-translate-y-0.5 hover:rotate-0 hover:scale-105",
        "motion-reduce:transition-none",
        slotIndex % 3 === 0 && "z-1 translate-y-1.75 rotate-[-5deg]",
        slotIndex % 3 === 1 && "z-2 -translate-y-1 rotate-[2.5deg]",
        slotIndex % 3 === 2 && "z-1 translate-y-2.25 rotate-[5deg]",
        (disabled || busy) && "pointer-events-none opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute -top-2.25 left-1/2 z-6 size-5.5 -translate-x-1/2 rounded-full border-2 border-ink",
          "shadow-[inset_-2px_-3px_0_rgba(25,23,28,.22),0_3px_0_-1px_var(--border-ink),0_5px_6px_rgba(25,23,28,.3)]",
          "after:absolute after:left-1 after:top-0.75 after:h-1.25 after:w-1.5 after:rotate-[-20deg] after:rounded-full after:bg-white/75 after:content-['']",
          slotIndex % 3 === 0 && "bg-primary",
          slotIndex % 3 === 1 && "bg-accent",
          slotIndex % 3 === 2 && "bg-secondary",
        )}
      />
      <span className="grid aspect-square w-full place-items-center content-center gap-1.5 rounded-[3px] border-2 border-dashed border-muted-foreground text-[11px] font-semibold text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <ImagePlus className="size-5" aria-hidden />
        )}
        {busy ? "Uploading…" : "Add photo"}
      </span>
      <span className="absolute right-2.5 bottom-1.75 left-2.5 flex text-[10.5px] font-bold tracking-wider text-[color-mix(in_srgb,var(--foreground)_35%,transparent)] uppercase">
        —
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_UPLOAD_TYPES.join(",")}
        multiple
        className="sr-only"
        disabled={disabled || busy}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <CropDialog
        file={cropQueue[0] ?? null}
        onCropped={acceptPhoto}
        onUseOriginal={(file) => acceptPhoto(file, null)}
        onCancel={() => setCropQueue((queue) => queue.slice(1))}
      />
    </label>
  );
}
