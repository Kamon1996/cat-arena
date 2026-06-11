import type { Buffer } from "node:buffer";
import type { ImageStatus } from "@prisma/client";

import { screenImage } from "@/moderation/screen-image";
import { type CropRect, processImage } from "@/storage/process-image";

export type ScreenedImage = {
  width: number;
  height: number;
  status: ImageStatus;
  /** P(is-a-cat) from the auto-screen, 0–1. Surfaced to the client for logging. */
  catConfidence: number;
  /** SHA-256 hex of the original bytes — the duplicate-detection key. */
  sha256: string;
  /** The framing actually applied to thumb/card (clamped); null = uncropped. */
  crop: CropRect | null;
};

/**
 * Derive WebP variants for an already-uploaded original (cats/<imageId>/original)
 * and auto-screen it. Returns the intrinsic dimensions and the moderation status.
 * Shared by POST /api/cats (create) and addCatImage (cabinet). Callers pass the
 * prefetched original when they already downloaded it for the dedupe check, and
 * the user's framing crop (duel variants only — see processImage).
 */
export async function ingestImage(
  imageId: string,
  prefetched?: Buffer,
  crop?: CropRect | null,
): Promise<ScreenedImage> {
  const processed = await processImage(imageId, prefetched, crop);
  const { status, catConfidence } = await screenImage(processed.screenBuffer);
  return {
    width: processed.width,
    height: processed.height,
    status,
    catConfidence,
    sha256: processed.sha256,
    crop: processed.crop,
  };
}
