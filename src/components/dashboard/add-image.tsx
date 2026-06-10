"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { addCatImage } from "@/cats/owner-actions";
import { catToast } from "@/components/ui/cat-toast";
import { uploadToR2 } from "@/components/upload/upload-to-r2";
import { ALLOWED_UPLOAD_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type AddImageProps = {
  catId: string;
  remaining: number;
  disabled?: boolean;
};

// Owner-action error codes → human messages (codes come from owner-actions.ts).
const ACTION_ERROR_MESSAGES: Record<string, string> = {
  duplicate_image: "This photo has already been uploaded.",
  image_limit: "Photo limit reached for this cat.",
  too_large: "This photo exceeds the upload size limit.",
  rate_limited: "Too many uploads — try again in a minute.",
};

/** A dashed "Add photo" cell that lives inside the gallery grid. Picking files
 *  uploads them straight to R2 and registers them (PENDING) on the cat. */
export function AddImage({ catId, remaining, disabled }: AddImageProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (remaining <= 0) {
    return null;
  }

  async function handleFiles(fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0 || busy) {
      return;
    }
    const files = Array.from(fileList).slice(0, remaining);
    setBusy(true);
    try {
      for (const file of files) {
        const { r2Key } = await uploadToR2(file);
        const result = await addCatImage(catId, r2Key);
        if (!result.ok) {
          throw new Error(result.error);
        }
      }
      catToast.success("Photo added · in review", {
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
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <label
      className={cn(
        "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground bg-muted text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:bg-[color-mix(in_oklab,var(--primary)_8%,var(--muted))] hover:text-primary",
        (disabled || busy) && "pointer-events-none opacity-60",
      )}
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        <ImagePlus className="size-5" aria-hidden />
      )}
      {busy ? "Uploading…" : "Add photo"}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_UPLOAD_TYPES.join(",")}
        multiple
        className="sr-only"
        disabled={disabled || busy}
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </label>
  );
}
