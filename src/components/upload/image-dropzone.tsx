"use client";

import { UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ALLOWED_UPLOAD_TYPES, MAX_IMAGES_PER_CAT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ImageDropzoneProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

function isAllowed(file: File): boolean {
  return (
    (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_UPLOAD_BYTES
  );
}

export function ImageDropzone({ files, onChange, disabled }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
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
    const accepted = Array.from(incoming).filter(isAllowed);
    const next = [...files, ...accepted].slice(0, MAX_IMAGES_PER_CAT);
    onChange(next);
  }

  function removeAt(index: number): void {
    onChange(files.filter((_, i) => i !== index));
  }

  const canAddMore = files.length < MAX_IMAGES_PER_CAT && !disabled;

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
          {files.map((file, index) => {
            const preview = previews[index];
            return (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="group relative aspect-square overflow-hidden rounded-md border-2 border-ink bg-muted"
              >
                {preview ? (
                  // biome-ignore lint/performance/noImgElement: local object-URL blob preview, not a remote asset
                  <img
                    src={preview}
                    alt={`Preview of ${file.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  aria-label={`Remove ${file.name}`}
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  className="absolute top-1 right-1 opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
