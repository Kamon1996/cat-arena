"use client";

import { Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import { catToast } from "@/components/ui/cat-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type CropAreaPixels, cropImageToFile } from "@/lib/crop-image";

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
  onCropped: (file: File) => void;
  onUseOriginal: (file: File) => void;
  /** Dismissed without a decision — the file is dropped entirely. */
  onCancel: () => void;
};

/**
 * Square cropper shown before a photo enters the upload list, configured like
 * the react-easy-crop reference demo: default objectFit (contain), so at
 * zoom 1 the whole photo is visible, the square frame auto-fits the photo's
 * short side, and everything outside the frame stays visible but dimmed —
 * any edge of the photo can be brought into the frame by dragging.
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
  const [busy, setBusy] = useState(false);
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

  const handleConfirm = async () => {
    if (!file || !areaPixels) {
      return;
    }
    setBusy(true);
    try {
      onCropped(await cropImageToFile(file, areaPixels));
    } catch {
      // Canvas/decode failure (rare): don't strand the user — fall back to the
      // original bytes, which the server pipeline handles fine.
      catToast.error("Could not crop the photo", {
        message: "The original photo will be used instead.",
      });
      onUseOriginal(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open && !busy) {
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Frame your cat</DialogTitle>
          <DialogDescription>
            The square is exactly what voters see on the duel card — drag and zoom until the face
            fills it.
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
            disabled={busy}
            aria-label="Zoom"
          />
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={busy || (zoom === MIN_ZOOM && crop.x === 0 && crop.y === 0)}
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
            disabled={busy}
            onClick={() => {
              if (file) {
                onUseOriginal(file);
              }
            }}
          >
            Keep original
          </Button>
          <Button type="button" disabled={busy || !areaPixels} onClick={() => void handleConfirm()}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {busy ? "Cropping…" : "Use this crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
