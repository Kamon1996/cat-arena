"use client";

import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** The chosen framing, in pixels of the photo as the browser shows it
 *  (EXIF-rotated) — applied SERVER-side to the duel variants only, so the
 *  uploaded original stays untouched. */
export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MIN_ZOOM = 1; // zoom 1 = whole photo visible (contain), frame on its short side
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.05;
const SQUARE_ASPECT = 1; // the duel card crops to a square — crop to the same shape
// DialogContent opens with a ~200ms zoom/fade animation (see ui/dialog.tsx).
// The cropper measures its container ONCE on mount, and its ResizeObserver
// never refires afterwards (CSS transforms don't change layout size) — so
// mounting mid-animation bakes in a scaled, offset rect and the photo + frame
// render shifted until something else triggers a re-measure. Wait it out.
const DIALOG_OPEN_ANIMATION_MS = 250;

type CropDialogProps = {
  /** File awaiting a crop decision; null keeps the dialog closed. */
  file: File | null;
  /** The chosen framing — the ORIGINAL file is kept; only the rect travels. */
  onCropped: (file: File, crop: CropAreaPixels) => void;
  onUseOriginal: (file: File) => void;
  /** Dismissed without a decision — the file is dropped entirely. */
  onCancel: () => void;
};

/**
 * Square framing dialog shown before a photo enters the upload list, set up
 * like the react-easy-crop reference demo: default objectFit (contain), so at
 * zoom 1 the whole photo is visible, the square frame auto-fits the photo's
 * short side, and everything outside the frame stays visible but dimmed —
 * any edge of the photo can be brought into the frame by dragging.
 *
 * The crop is NOT applied client-side: the original uploads untouched and the
 * rect is applied by the server to the duel variants, so lightboxes can always
 * show the real photo.
 *
 * NOTE: do NOT add `classes={{ mediaClassName: "max-w-none" }}` here — the
 * contain layout RELIES on the library's `max-width/height: 100%` rules; that
 * override is only ever needed for objectFit="cover" (Tailwind preflight
 * conflict), which this dialog does not use.
 */
export function CropDialog({ file, onCropped, onUseOriginal, onCancel }: CropDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [areaPixels, setAreaPixels] = useState<CropAreaPixels | null>(null);
  // True once the dialog's open animation has finished — only then is it safe
  // to mount the cropper (it measures the container on mount, see above).
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file) {
      setSettled(false);
      return;
    }
    if (settled) {
      return; // queue advanced while already open — no new entrance animation
    }
    const timer = window.setTimeout(() => setSettled(true), DIALOG_OPEN_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [file, settled]);

  const handleConfirm = () => {
    if (!file || !areaPixels) {
      return;
    }
    onCropped(file, {
      x: Math.round(areaPixels.x),
      y: Math.round(areaPixels.y),
      width: Math.round(areaPixels.width),
      height: Math.round(areaPixels.height),
    });
  };

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Frame your cat</DialogTitle>
          <DialogDescription>
            The square is exactly what voters see on the duel card — drag and zoom until the face
            fills it. The full photo stays untouched on the cat's page.
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden rounded-md border-2 border-ink bg-white">
          {imageUrl && settled ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={SQUARE_ASPECT}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area: Area, pixels: Area) => setAreaPixels(pixels)}
            />
          ) : imageUrl ? (
            // Placeholder while the dialog's open animation settles: same
            // geometry as the cropper's initial state (contain, centered), so
            // the swap to the live cropper is seamless — no white flash.
            // biome-ignore lint/performance/noImgElement: local object-URL blob preview, not a remote asset
            <img src={imageUrl} alt="" aria-hidden className="size-full object-contain" />
          ) : null}
        </div>
        <p className="text-center text-muted-foreground text-xs">
          Drag to reposition · pinch or scroll to zoom
        </p>
        <div className="flex items-center gap-2">
          <ZoomOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="flex-1 accent-primary"
            aria-label="Zoom"
          />
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={zoom === MIN_ZOOM && crop.x === 0 && crop.y === 0}
            onClick={() => {
              setZoom(MIN_ZOOM);
              setCrop({ x: 0, y: 0 });
            }}
          >
            <RotateCcw aria-hidden />
            Reset
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (file) {
                onUseOriginal(file);
              }
            }}
          >
            Keep original
          </Button>
          <Button type="button" disabled={!areaPixels} onClick={handleConfirm}>
            Use this crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
