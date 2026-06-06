import type { ImageStatus } from "@prisma/client";

import { screenImage } from "@/moderation/screen-image";
import { processImage } from "@/storage/process-image";

export type ScreenedImage = {
  width: number;
  height: number;
  status: ImageStatus;
  /** P(is-a-cat) from the auto-screen, 0–1. Surfaced to the client for logging. */
  catConfidence: number;
};

/**
 * Derive WebP variants for an already-uploaded original (cats/<imageId>/original)
 * and auto-screen it. Returns the intrinsic dimensions and the moderation status.
 * Shared by POST /api/cats (create) and addCatImage (cabinet).
 */
export async function ingestImage(imageId: string): Promise<ScreenedImage> {
  const { width, height, screenBuffer } = await processImage(imageId);
  const { status, catConfidence } = await screenImage(screenBuffer);
  return { width, height, status, catConfidence };
}
