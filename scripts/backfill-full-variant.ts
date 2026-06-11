import { Buffer } from "node:buffer";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

/**
 * Backfill the `full.webp` lightbox variant for CatImages created before the
 * server-side-crop feature: lightboxes now read cats/<id>/full.webp, which old
 * rows never had generated. Renders the stored original (rotation baked,
 * fit-inside 1600) — for photos that were client-cropped at upload the stored
 * original IS the crop, so this preserves them exactly as uploaded.
 *
 * Re-runnable and additive (PUT is idempotent). Standalone by design: reads
 * process.env and builds its own S3 client. Run with:
 *   dotenv -e .env.local -- npx tsx scripts/backfill-full-variant.ts
 */

const FULL_EDGE = 1600;
const WEBP_QUALITY = 82;

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint:
    process.env.S3_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});
const prisma = new PrismaClient();
const bucket = process.env.R2_BUCKET ?? "";

async function fetchBytes(key: string): Promise<Buffer | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = res.Body as { transformToByteArray: () => Promise<Uint8Array> };
    return Buffer.from(await body.transformToByteArray());
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const rows = await prisma.catImage.findMany({ select: { id: true, r2Key: true } });
  console.log(`[backfill-full] ${rows.length} image(s)`);

  let done = 0;
  let missing = 0;

  for (const row of rows) {
    const original = await fetchBytes(row.r2Key);
    if (!original) {
      missing += 1;
      console.warn(`  ! ${row.id}: original missing (${row.r2Key}) — skipped`);
      continue;
    }
    const full = await sharp(original)
      .rotate()
      .resize(FULL_EDGE, FULL_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `cats/${row.id}/full.webp`,
        Body: full,
        ContentType: "image/webp",
      }),
    );
    done += 1;
    console.log(`  ✓ ${row.id}: full.webp (${Math.round(full.byteLength / 1024)} KB)`);
  }

  console.log(`[backfill-full] done: ${done} written, ${missing} missing`);
  await prisma.$disconnect();
}

void main();
