"use client";

import { Ban, Trash2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { addCatImage, deleteCatImage, deleteCatOwned } from "@/cats/owner-actions";
import { AddImage } from "@/components/dashboard/add-image";
import { PhotoLightbox } from "@/components/dashboard/photo-lightbox";
import { type PolaroidPhoto, PolaroidPrint } from "@/components/dashboard/polaroid-print";
import { RenameCatForm } from "@/components/dashboard/rename-cat-form";
import { CatStatChips } from "@/components/dashboard/stat-chips";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { catToast } from "@/components/ui/cat-toast";
import { CropDialog } from "@/components/upload/crop-dialog";
import { uploadToR2 } from "@/components/upload/upload-to-r2";
import { ALLOWED_UPLOAD_TYPES, MAX_IMAGES_PER_CAT } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type CatCardImage = PolaroidPhoto;

export type CatCardData = {
  id: string;
  name: string;
  status: string;
  rank: number | null;
  score: number;
  rating: number;
  rd: number;
  wins: number;
  losses: number;
  timesShown: number;
  images: CatCardImage[];
};

// Scrapbook paper: fine dot grid over a faint yellow-tinted card.
const PAPER_CLASS = cn(
  "bg-[color-mix(in_srgb,var(--delight)_8%,var(--card))]",
  "bg-[image:radial-gradient(color-mix(in_srgb,var(--border-ink)_5%,transparent)_1px,transparent_1.5px)]",
  "bg-[size:16px_16px]",
);

export function CatCard({ cat }: { cat: CatCardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // The picked replacement waits here for its crop decision (same dialog as upload).
  const [replaceCropFile, setReplaceCropFile] = useState<File | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  const banned = cat.status === "BANNED";
  const remaining = MAX_IMAGES_PER_CAT - cat.images.length;

  async function removeImage(imageId: string): Promise<void> {
    setBusy(true);
    const result = await deleteCatImage(imageId);
    setBusy(false);
    if (result.ok) {
      catToast.success("Photo removed", { message: "You can pin up another anytime." });
      router.refresh();
    } else {
      catToast.error("Could not remove photo", { message: result.error });
    }
  }

  async function removeCat(): Promise<void> {
    setBusy(true);
    const result = await deleteCatOwned(cat.id);
    setBusy(false);
    if (result.ok) {
      catToast.success(`${cat.name} deleted`);
      router.refresh();
    } else {
      catToast.error("Could not delete cat", { message: result.error });
    }
  }

  /**
   * Replace a rejected print: upload the new bytes, then swap DB rows in the
   * order that dodges both guards — at the photo cap, delete-then-add (no
   * image_limit); below it, add-then-delete (no last_image on a 1-photo cat).
   */
  async function replaceImage(file: File): Promise<void> {
    const oldId = replaceTargetRef.current;
    if (!oldId) {
      return;
    }
    setBusy(true);
    try {
      const { r2Key } = await uploadToR2(file);
      if (cat.images.length >= MAX_IMAGES_PER_CAT) {
        const removed = await deleteCatImage(oldId);
        if (!removed.ok) {
          throw new Error(removed.error);
        }
        const added = await addCatImage(cat.id, r2Key);
        if (!added.ok) {
          throw new Error(added.error);
        }
      } else {
        const added = await addCatImage(cat.id, r2Key);
        if (!added.ok) {
          throw new Error(added.error);
        }
        const removed = await deleteCatImage(oldId);
        if (!removed.ok) {
          throw new Error(removed.error);
        }
      }
      catToast.success("Photo replaced · in review", {
        variant: "mascot",
        message: "We'll approve the new print before it enters the arena.",
      });
      router.refresh();
    } catch (err) {
      catToast.error("Could not replace photo", {
        message: err instanceof Error && err.message ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
      replaceTargetRef.current = null;
      if (replaceInputRef.current) {
        replaceInputRef.current.value = "";
      }
    }
  }

  return (
    <article
      aria-label={cat.name}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border-2 border-ink px-5 pt-5 pb-3.5 shadow-sticker-lg",
        PAPER_CLASS,
        banned && "opacity-90",
      )}
    >
      {/* Head: name · rename · rank medallion · cat status */}
      <div className="flex items-center gap-2.5">
        <RenameCatForm catId={cat.id} currentName={cat.name} disabled={banned || busy} />
        {cat.rank !== null ? (
          <span className="inline-flex shrink-0 -rotate-3 items-center gap-1 rounded-full border-2 border-ink bg-delight px-3 py-1 font-display text-sm font-bold text-delight-foreground shadow-sticker-press">
            <Trophy className="size-3.5" aria-hidden />#{cat.rank}
          </span>
        ) : null}
        <StatusBadge status={cat.status} className="shrink-0" />
      </div>

      {/* Board: pinned polaroid prints + empty slot while photos < 3 */}
      <div className="flex justify-center gap-1 px-1 pt-6 pb-2">
        {cat.images.map((photo, index) => (
          <PolaroidPrint
            key={photo.id}
            photo={photo}
            index={index}
            busy={busy}
            readOnly={banned}
            onOpen={() => setLightboxIndex(index)}
            onRemove={() => void removeImage(photo.id)}
            onReplace={() => {
              replaceTargetRef.current = photo.id;
              replaceInputRef.current?.click();
            }}
          />
        ))}
        {banned || remaining <= 0 ? null : (
          <AddImage
            catId={cat.id}
            remaining={remaining}
            disabled={busy}
            slotIndex={cat.images.length}
          />
        )}
      </div>

      <CatStatChips stats={cat} className="justify-center px-1.5 pt-3.5 pb-0.5" />

      {/* Foot: photo count + delete (or the read-only note for banned cats) */}
      {banned ? (
        <div className="pt-3 pb-1.5">
          <div className="flex items-center gap-2 rounded-md border-2 border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            <Ban className="size-4 shrink-0" aria-hidden />
            This cat was removed for breaking the rules and is now read-only.
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">
            {cat.images.length} of {MAX_IMAGES_PER_CAT} photos
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-destructive hover:bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] hover:text-destructive"
              >
                <Trash2 />
                Delete cat
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {cat.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all of {cat.name}'s photos and rating. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep cat</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void removeCat()}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Hidden picker for the on-print Replace action — the file goes through
          the crop dialog before the swap, just like the upload form. */}
      <input
        ref={replaceInputRef}
        type="file"
        accept={ALLOWED_UPLOAD_TYPES.join(",")}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            setReplaceCropFile(file);
          }
          if (replaceInputRef.current) {
            replaceInputRef.current.value = "";
          }
        }}
      />
      <CropDialog
        file={replaceCropFile}
        onCropped={(file) => {
          setReplaceCropFile(null);
          void replaceImage(file);
        }}
        onUseOriginal={(file) => {
          setReplaceCropFile(null);
          void replaceImage(file);
        }}
        onCancel={() => {
          setReplaceCropFile(null);
          replaceTargetRef.current = null;
        }}
      />

      <PhotoLightbox
        catName={cat.name}
        photos={cat.images.map((photo) => ({
          url: photo.fullUrl,
          thumbUrl: photo.thumbUrl,
          width: photo.width,
          height: photo.height,
          status: photo.status,
        }))}
        openIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </article>
  );
}
