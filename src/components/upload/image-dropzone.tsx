"use client";

import { useEffect, useRef, useState } from "react";

import { ALLOWED_UPLOAD_TYPES, MAX_IMAGES_PER_CAT, MAX_UPLOAD_BYTES } from "@/lib/constants";

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
    <div>
      {/* biome-ignore lint/a11y/useSemanticElements: drag-and-drop target must be a div; a <button> cannot host drag events or contain an <input> child */}
      <div
        role="button"
        tabIndex={canAddMore ? 0 : -1}
        aria-label="Image upload area. Click or drag cat photos to upload."
        data-dragging={dragging}
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
        <p>Drag cat photos here, or click to choose (up to {MAX_IMAGES_PER_CAT}).</p>
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

      <ul>
        {files.map((file, index) => {
          const preview = previews[index];
          return (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              {preview ? (
                // biome-ignore lint/performance/noImgElement: local object-URL blob preview, not a remote asset
                <img src={preview} alt={`Preview of ${file.name}`} width={96} />
              ) : null}
              <button type="button" onClick={() => removeAt(index)} disabled={disabled}>
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
