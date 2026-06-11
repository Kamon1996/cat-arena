import { Buffer } from "node:buffer";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

/**
 * Backfill thumb.webp + card.webp for ALL CatImages. Needed once the duel
 * switched from serving the raw original to cardUrl(id): seed cats (and any
 * image that never went through processImage) have no derivatives, so their
 * duel cards would 404. Renders from the stored original (for photos that
 * were client-cropped at upload the stored original IS the crop, so duel
 * framing is preserved exactly).
 *
 * Re-runnable (PUT is idempotent). Standalone by design — reads process.env.
 * Run with:  dotenv -e .env.local -- npx tsx scripts/backfill-card-variants.ts
 */

const THUMB_EDGE = 200;
const CARD_EDGE = 800;
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

async function putVariant(key: string, original: Buffer, edge: number): Promise<void> {
  const body = await sharp(original)
    .rotate()
    .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "image/webp" }),
  );
}

async function main(): Promise<void> {
  const rows = await prisma.catImage.findMany({ select: { id: true, r2Key: true } });
  console.log(`[backfill-card] ${rows.length} image(s)`);

  let done = 0;
  let missing = 0;

  for (const row of rows) {
    const original = await fetchBytes(row.r2Key);
    if (!original) {
      missing += 1;
      console.warn(`  ! ${row.id}: original missing (${row.r2Key}) — skipped`);
      continue;
    }
    await putVariant(`cats/${row.id}/thumb.webp`, original, THUMB_EDGE);
    await putVariant(`cats/${row.id}/card.webp`, original, CARD_EDGE);
    done += 1;
    console.log(`  ✓ ${row.id}: thumb + card`);
  }

  console.log(`[backfill-card] done: ${done} written, ${missing} missing`);
  await prisma.$disconnect();
}

void main();
