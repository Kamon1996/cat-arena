import { Buffer } from "node:buffer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

/**
 * Populate the seed cats' R2 objects with real cat photos.
 *
 * `prisma/seed.ts` creates 8 ACTIVE cats whose single APPROVED image points at
 * `seed/<name>.webp`, but nothing ever uploads those bytes — so the duel /
 * leaderboard / cat pages render broken images against a fresh R2 bucket. This
 * one-off, re-runnable script downloads a public cat photo per seed cat,
 * normalizes it to a square WebP (matching the seed's 800x800 intrinsic size),
 * and PUTs it at the expected key.
 *
 * Standalone by design (like the Prisma seed): it reads process.env and builds
 * its own S3 client instead of importing app code, so `tsx` needs no path-alias
 * resolution. Run with:  dotenv -e .env.local -- npx tsx scripts/upload-seed-images.ts
 */

const SEED_KEYS = [
  "seed/mittens.webp",
  "seed/shadow.webp",
  "seed/whiskers.webp",
  "seed/luna.webp",
  "seed/oliver.webp",
  "seed/bella.webp",
  "seed/simba.webp",
  "seed/cleo.webp",
] as const;

const IMAGE_SIZE = 800;
const WEBP_QUALITY = 82;
const SOURCE_URL = "https://cataas.com/cat";
const MAX_FETCH_ATTEMPTS = 4;
const CONTENT_TYPE = "image/webp";
// Public bucket served via CDN; cache the immutable seed objects aggressively.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const accountId = requireEnv("R2_ACCOUNT_ID");
const bucket = requireEnv("R2_BUCKET");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});

/** Fetch one random cat photo, retrying a few times against transient errors. */
async function fetchCatPhoto(): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      // Cache-bust so the public source returns a distinct cat per key.
      const res = await fetch(`${SOURCE_URL}?_=${Date.now()}-${attempt}-${Math.random()}`);
      if (!res.ok) {
        throw new Error(`source responded ${res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Failed to fetch a cat photo after ${MAX_FETCH_ATTEMPTS} attempts: ${lastError}`);
}

async function toSquareWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // bake EXIF orientation
    .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

async function main(): Promise<void> {
  for (const key of SEED_KEYS) {
    const original = await fetchCatPhoto();
    const webp = await toSquareWebp(original);
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: webp,
        ContentType: CONTENT_TYPE,
        CacheControl: CACHE_CONTROL,
      }),
    );
    console.log(`uploaded ${key} (${webp.byteLength} bytes)`);
  }
  console.log(`Done: ${SEED_KEYS.length} seed images uploaded to bucket "${bucket}".`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
