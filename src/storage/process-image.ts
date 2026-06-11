import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { IMAGE_SIZE, WEBP_QUALITY } from "@/lib/constants";
import { env } from "@/lib/env";
import { getR2 } from "@/lib/r2";
import { cardKey, fullKey, originalKey, thumbKey } from "@/storage/keys";

/** User-chosen framing, in pixels of the rotation-baked original. Applied
 *  server-side to the duel-facing variants (thumb/card) only — the stored
 *  original and the `full` lightbox variant stay uncropped. */
export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ProcessedImage = {
  width: number; // intrinsic width of the (rotation-baked) original
  height: number;
  /** EXIF-stripped JPEG of the FULL (uncropped) photo — what moderation screens. */
  screenBuffer: Buffer;
  /** SHA-256 hex of the original bytes as uploaded — the duplicate-detection key. */
  sha256: string;
  /** The framing actually applied to thumb/card (clamped); null = uncropped. */
  crop: CropRect | null;
};

/** Download the uploaded original from R2 into memory. */
export async function fetchOriginal(imageId: string): Promise<Buffer> {
  const res = await getR2().send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: originalKey(imageId) }),
  );
  const body = res.Body as { transformToByteArray: () => Promise<Uint8Array> };
  return Buffer.from(await body.transformToByteArray());
}

/** SHA-256 hex of the bytes as uploaded — the duplicate-detection key. */
export function sha256OfBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function putWebp(key: string, body: Buffer): Promise<void> {
  await getR2().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/webp",
    }),
  );
}

/** Intersect a client-supplied crop with the image bounds; null when the
 *  intersection is empty — a wild rect falls back to "no crop" instead of
 *  snapping to a 1px sliver at the nearest edge. */
function clampCrop(
  crop: CropRect | null | undefined,
  width: number,
  height: number,
): CropRect | null {
  if (!crop || width <= 0 || height <= 0) {
    return null;
  }
  const left = Math.max(Math.round(crop.x), 0);
  const top = Math.max(Math.round(crop.y), 0);
  const right = Math.min(Math.round(crop.x + crop.width), width);
  const bottom = Math.min(Math.round(crop.y + crop.height), height);
  if (right - left < 1 || bottom - top < 1) {
    return null;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Fetch the original from R2 (unless the caller already holds it), bake EXIF
 * rotation, strip metadata, and write the WebP variants back to R2:
 * - thumb (200) and card (800) from the user's crop (when given) — what duels show;
 * - full (1600, ALWAYS uncropped) — what lightboxes show, the photo as shot.
 * Returns the uncropped intrinsic dimensions, the applied (clamped) framing,
 * and a JPEG of the FULL photo for moderation screening. Callers that need the
 * hash BEFORE this heavy work (the dedupe check) fetch the buffer themselves
 * and pass it in.
 */
export async function processImage(
  imageId: string,
  prefetched?: Buffer,
  crop?: CropRect | null,
): Promise<ProcessedImage> {
  const original = prefetched ?? (await fetchOriginal(imageId));
  // Hash the bytes as uploaded (pre-rotation/encoding) so the digest matches
  // what the client can compute locally before uploading.
  const sha256 = sha256OfBuffer(original);

  // metadata() reads the file header and IGNORES the operation pipeline, so a
  // queued .rotate() does not affect it. Use the orientation-adjusted dims:
  // that is the space the browser displays — and the space the crop arrives in.
  // (A portrait phone JPEG stores landscape pixels + EXIF orientation 5–8.)
  const meta = await sharp(original).metadata();
  const width = meta.autoOrient.width ?? 0;
  const height = meta.autoOrient.height ?? 0;

  // The crop arrives in coordinates of the rotation-baked image (that is what
  // the browser shows the user), so extract AFTER rotate().
  const framing = clampCrop(crop, width, height);
  const framed = () => {
    const pipeline = sharp(original).rotate();
    return framing
      ? pipeline.extract({
          left: framing.x,
          top: framing.y,
          width: framing.width,
          height: framing.height,
        })
      : pipeline;
  };

  const thumb = await framed()
    .resize(IMAGE_SIZE.THUMB, IMAGE_SIZE.THUMB, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const card = await framed()
    .resize(IMAGE_SIZE.CARD, IMAGE_SIZE.CARD, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // The lightbox variant is never cropped: it shows the photo as shot.
  const full = await sharp(original)
    .rotate()
    .resize(IMAGE_SIZE.FULL, IMAGE_SIZE.FULL, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  await putWebp(thumbKey(imageId), thumb);
  await putWebp(cardKey(imageId), card);
  await putWebp(fullKey(imageId), full);

  // Workers AI models expect JPEG, not WebP. Screen the FULL photo, not the
  // duel crop: the uncropped image is what goes public (cat page, lightbox),
  // and the crop is a subset of it anyway.
  const screenBuffer = await sharp(original)
    .rotate()
    .resize(IMAGE_SIZE.CARD, IMAGE_SIZE.CARD, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    width,
    height,
    screenBuffer,
    sha256,
    crop: framing,
  };
}
