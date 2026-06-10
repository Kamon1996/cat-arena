import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

/**
 * Backfill `CatImage.sha256` for rows created before the dedupe migration
 * (20260610000000): the column is nullable, NULL never matches the duplicate
 * check, so the dedupe guarantee is silently void for pre-existing photos
 * until their hashes are filled.
 *
 * Re-runnable and additive: only rows with `sha256 IS NULL` are touched.
 * A unique-constraint collision means the same bytes already exist on another
 * row (a pre-existing duplicate) — logged and skipped for manual triage,
 * never deleted automatically.
 *
 * Standalone by design (like the Prisma seed): reads process.env and builds
 * its own S3 client, so `tsx` needs no path-alias resolution. Run with:
 *   dotenv -e .env.local -- npx tsx scripts/backfill-sha256.ts
 */

// Same endpoint derivation as src/lib/r2.ts: explicit S3_ENDPOINT, else R2.
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

async function fetchBytes(key: string): Promise<Buffer | null> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET ?? "", Key: key }),
    );
    const body = res.Body as { transformToByteArray: () => Promise<Uint8Array> };
    return Buffer.from(await body.transformToByteArray());
  } catch {
    return null; // object missing in R2 — leave the row for manual triage
  }
}

async function main(): Promise<void> {
  const rows = await prisma.catImage.findMany({
    where: { sha256: null },
    select: { id: true, r2Key: true },
  });
  console.log(`[backfill-sha256] ${rows.length} row(s) with NULL sha256`);

  let filled = 0;
  let missing = 0;
  let collisions = 0;

  for (const row of rows) {
    const bytes = await fetchBytes(row.r2Key);
    if (!bytes) {
      missing += 1;
      console.warn(`  ! ${row.id}: R2 object missing (${row.r2Key}) — skipped`);
      continue;
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    try {
      await prisma.catImage.update({ where: { id: row.id }, data: { sha256 } });
      filled += 1;
      console.log(`  ✓ ${row.id}: ${sha256.slice(0, 12)}…`);
    } catch {
      collisions += 1;
      console.warn(
        `  ! ${row.id}: hash already taken (pre-existing duplicate of ${sha256.slice(0, 12)}…) — needs manual triage`,
      );
    }
  }

  console.log(
    `[backfill-sha256] done: ${filled} filled, ${missing} missing in R2, ${collisions} collisions`,
  );
  await prisma.$disconnect();
}

void main();
