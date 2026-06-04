import { Buffer } from "node:buffer";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { IMAGE_SIZE, WEBP_QUALITY } from "@/lib/constants";
import { env } from "@/lib/env";
import { r2 } from "@/lib/r2";
import { cardKey, originalKey, thumbKey } from "@/storage/keys";

export type ProcessedImage = {
  width: number; // intrinsic width of the (rotation-baked) original
  height: number;
  /** The decoded, EXIF-stripped original WebP buffer — reused by the NSFW screen. */
  screenBuffer: Buffer;
};

async function getOriginal(imageId: string): Promise<Buffer> {
  const res = await r2.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: originalKey(imageId) }),
  );
  const body = res.Body as { transformToByteArray: () => Promise<Uint8Array> };
  return Buffer.from(await body.transformToByteArray());
}

async function putWebp(key: string, body: Buffer): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/webp",
    }),
  );
}

/**
 * Fetch the original from R2, bake EXIF rotation, strip metadata, and write
 * WebP thumb (200) and card (800) variants back to R2. Returns intrinsic
 * dimensions plus a decoded WebP buffer reused for NSFW screening.
 */
export async function processImage(imageId: string): Promise<ProcessedImage> {
  const original = await getOriginal(imageId);

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

  // sharp output strips metadata by default → EXIF removed in card.
  const screenBuffer = card;

  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    screenBuffer,
  };
}
