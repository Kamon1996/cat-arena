import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { IMAGE_SIZE, WEBP_QUALITY } from "@/lib/constants";
import { env } from "@/lib/env";
import { getR2 } from "@/lib/r2";
import { cardKey, originalKey, thumbKey } from "@/storage/keys";

export type ProcessedImage = {
  width: number; // intrinsic width of the (rotation-baked) original
  height: number;
  /** The decoded, EXIF-stripped original WebP buffer — reused by the NSFW screen. */
  screenBuffer: Buffer;
  /** SHA-256 hex of the original bytes as uploaded — the duplicate-detection key. */
  sha256: string;
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

/**
 * Fetch the original from R2 (unless the caller already holds it), bake EXIF
 * rotation, strip metadata, and write WebP thumb (200) and card (800) variants
 * back to R2. Returns intrinsic dimensions plus a decoded WebP buffer reused
 * for NSFW screening. Callers that need the hash BEFORE this heavy work (the
 * dedupe check) fetch the buffer themselves and pass it in.
 */
export async function processImage(imageId: string, prefetched?: Buffer): Promise<ProcessedImage> {
  const original = prefetched ?? (await fetchOriginal(imageId));
  // Hash the bytes as uploaded (pre-rotation/encoding) so the digest matches
  // what the client can compute locally before uploading.
  const sha256 = sha256OfBuffer(original);

  // Decode once, bake orientation (Node sharp does not auto-rotate on read).
  const base = sharp(original).rotate();
  const meta = await base.metadata();

  const thumb = await sharp(original)
    .rotate()
    .resize(IMAGE_SIZE.THUMB, IMAGE_SIZE.THUMB, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const card = await sharp(original)
    .rotate()
    .resize(IMAGE_SIZE.CARD, IMAGE_SIZE.CARD, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  await putWebp(thumbKey(imageId), thumb);
  await putWebp(cardKey(imageId), card);

  // Workers AI nsfw_image_detection + resnet-50 expect JPEG, not WebP.
  const screenBuffer = await sharp(original)
    .rotate()
    .resize(IMAGE_SIZE.CARD, IMAGE_SIZE.CARD, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    screenBuffer,
    sha256,
  };
}
