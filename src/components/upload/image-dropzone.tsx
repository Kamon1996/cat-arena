"use client";

import { Check, Crop, RotateCcw, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { type CropAreaPixels, CropDialog } from "@/components/upload/crop-dialog";
import { CroppedThumb } from "@/components/upload/cropped-thumb";
import type { EagerUpload } from "@/components/upload/use-eager-uploads";
import { ALLOWED_UPLOAD_TYPES, MAX_IMAGES_PER_CAT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** A picked photo plus its duel framing. The ORIGINAL file uploads untouched;
 *  the crop rect (null = keep default framing) is applied server-side. */
export type PickedPhoto = {
  /** Stable client id — keys the tile, the upload state and re-crop edits. */
  id: string;
  file: File;
  crop: CropAreaPixels | null;
};

type ImageDropzoneProps = {
  files: PickedPhoto[];
  onChange: (files: PickedPhoto[]) => void;
  disabled?: boolean;
  /** Eager-upload state per photo id — drives the per-tile progress/error UI. */
  uploads?: Record<string, EagerUpload>;
  onRetryUpload?: (photo: PickedPhoto) => void;
};

const PROGRESS_MAX = 100;

function isAllowed(file: File): boolean {
  return (
    (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_UPLOAD_BYTES
  );
}

export function ImageDropzone({
  files,
  onChange,
  disabled,
  uploads,
  onRetryUpload,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  // Newly picked files wait here for a crop decision before joining `files`.
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  // Photo being re-framed from its tile; takes the dialog over the queue.
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((p) => URL.createObjectURL(p.file));
    setPreviews(urls);
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [files]);

  function addFiles(incoming: FileList | null): void {
    if (!incoming) {
      return;
    }
    // Drop re-picks of an already-selected file: the server rejects duplicate
    // photos anyway (after uploading them), and identical files would collide
    // on the name-size-lastModified preview key below.
    const fileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
    const present = new Set([...files.map((p) => p.file), ...cropQueue].map(fileKey));
    const remaining = MAX_IMAGES_PER_CAT - files.length - cropQueue.length;
    const accepted = Array.from(incoming)
      .filter((f) => {
        if (!isAllowed(f) || present.has(fileKey(f))) {
          return false;
        }
        present.add(fileKey(f));
        return true;
      })
      .slice(0, Math.max(0, remaining));
    // Every new photo goes through the crop step before it joins the list.
    setCropQueue((queue) => [...queue, ...accepted]);
  }

  /** Crop decision for the queue head: keep the photo with its framing. */
  function acceptPhoto(file: File, crop: CropAreaPixels | null): void {
    onChange([...files, { id: crypto.randomUUID(), file, crop }].slice(0, MAX_IMAGES_PER_CAT));
    setCropQueue((queue) => queue.slice(1));
  }

  /** Re-crop decision: only the rect changes — the upload is never redone. */
  function updateCrop(id: string, crop: CropAreaPixels | null): void {
    onChange(files.map((p) => (p.id === id ? { ...p, crop } : p)));
    setEditId(null);
  }

  /** Dialog dismissed — drop the queue head, or just leave re-crop mode. */
  function dismissDialog(): void {
    if (editId !== null) {
      setEditId(null);
      return;
    }
    setCropQueue((queue) => queue.slice(1));
  }

  function removeAt(index: number): void {
    onChange(files.filter((_, i) => i !== index));
  }

  const editTarget = editId !== null ? (files.find((p) => p.id === editId) ?? null) : null;
  const dialogFile = editTarget?.file ?? cropQueue[0] ?? null;
  const canAddMore = files.length + cropQueue.length < MAX_IMAGES_PER_CAT && !disabled;

  return (
    <div className="flex flex-col gap-3">
      {/* biome-ignore lint/a11y/useSemanticElements: drag-and-drop target must be a div; a <button> cannot host drag events or contain an <input> child */}
      <div
        role="button"
        tabIndex={canAddMore ? 0 : -1}
        aria-label="Image upload area. Click or drag cat photos to upload."
        data-dragging={dragging}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground px-4 py-8 text-center text-sm transition-colors",
          canAddMore
            ? "cursor-pointer hover:border-primary hover:bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))] hover:text-primary"
            : "cursor-not-allowed opacity-60",
          dragging &&
            "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))] text-primary",
        )}
        onClick={() => {
          if (canAddMore) {
            inputRef.current?.click();
          }
        }}
        onKeyDown={(e) => {
          if (canAddMore && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragCounter.current += 1;
          setDragging(true);
        }}
        onDragLeave={() => {
          dragCounter.current -= 1;
          if (dragCounter.current === 0) {
            setDragging(false);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          dragCounter.current = 0;
          setDragging(false);
          if (canAddMore) {
            addFiles(e.dataTransfer.files);
          }
        }}
      >
        <UploadCloud className="size-6 text-muted-foreground" />
        <p className="font-medium">Drag cat photos here, or click to choose</p>
        <p className="text-muted-foreground text-xs">
          JPEG, PNG or WebP · up to {MAX_IMAGES_PER_CAT} images
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_UPLOAD_TYPES.join(",")}
          multiple
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {files.map((photo, index) => {
            const preview = previews[index];
            const upload = uploads?.[photo.id];
            return (
              <li
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-md border-2 border-ink bg-muted"
              >
                {preview ? (
                  // The preview shows the photo THROUGH its framing — exactly
                  // what the duel card will look like after the server crop.
                  <CroppedThumb
                    src={preview}
                    crop={photo.crop}
                    alt={`Preview of ${photo.file.name}`}
                  />
                ) : null}

                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  aria-label={`Adjust crop of ${photo.file.name}`}
                  disabled={disabled || cropQueue.length > 0}
                  onClick={() => setEditId(photo.id)}
                  className="absolute top-1 left-1 opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Crop />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  aria-label={`Remove ${photo.file.name}`}
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  className="absolute top-1 right-1 opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X />
                </Button>

                {upload?.status === "hashing" || upload?.status === "uploading" ? (
                  <div
                    role="progressbar"
                    aria-label={`Uploading ${photo.file.name}`}
                    aria-valuemin={0}
                    aria-valuemax={PROGRESS_MAX}
                    aria-valuenow={upload.progress}
                    className="absolute inset-x-0 bottom-0 h-1.5 bg-[rgba(25,23,28,.25)]"
                  >
                    <div
                      className="h-full bg-primary transition-[width] duration-200"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                ) : null}

                {upload?.status === "uploaded" ? (
                  <span
                    className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full border border-ink bg-success text-success-foreground"
                    title="Uploaded"
                  >
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                    <span className="sr-only">Uploaded</span>
                  </span>
                ) : null}

                {upload?.status === "error" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-card/90 p-2 text-center">
                    <p className="line-clamp-2 font-medium text-destructive text-xs" role="alert">
                      {upload.error ?? "Upload failed"}
                    </p>
                    {onRetryUpload ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={disabled}
                        onClick={() => onRetryUpload(photo)}
                      >
                        <RotateCcw aria-hidden />
                        Retry
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <CropDialog
        file={dialogFile}
        initialAreaPixels={editTarget?.crop ?? null}
        onCropped={(file, crop) =>
          editTarget ? updateCrop(editTarget.id, crop) : acceptPhoto(file, crop)
        }
        onUseOriginal={(file) =>
          editTarget ? updateCrop(editTarget.id, null) : acceptPhoto(file, null)
        }
        onCancel={dismissDialog}
      />
    </div>
  );
}
