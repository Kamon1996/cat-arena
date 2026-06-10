"use client";

import { Loader2 } from "lucide-react";
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.05;
const SQUARE_ASPECT = 1; // the duel card crops to a square — crop to the same shape

type CropDialogProps = {
  /** File awaiting a crop decision; null keeps the dialog closed. */
  file: File | null;
  onCropped: (file: File) => void;
  onUseOriginal: (file: File) => void;
  /** Dismissed without a decision — the file is dropped entirely. */
  onCancel: () => void;
};

/**
 * Square cropper shown before a photo enters the upload list. The viewport IS
 * the duel-card preview: what's inside the square is exactly what voters see.
 */
export function CropDialog({ file, onCropped, onUseOriginal, onCancel }: CropDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [areaPixels, setAreaPixels] = useState<CropAreaPixels | null>(null);
  const [busy, setBusy] = useState(false);

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

        <div className="relative h-72 w-full overflow-hidden rounded-md border-2 border-ink bg-muted">
          {imageUrl ? (
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
          ) : null}
        </div>

        <label className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Zoom</span>
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
        </label>

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
