import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Apply the R2 bucket CORS policy so the browser can PUT directly to a presigned
 * URL (the upload flow: POST /api/upload/sign → fetch(PUT) the file to R2).
 *
 * Without this, R2 answers the CORS preflight (OPTIONS) with 403 and the upload
 * fails with "Failed to fetch". Standalone (reads process.env, no app imports):
 *   dotenv -e .env.local -- npx tsx scripts/set-r2-cors.ts
 */

// Production domain only — uploads to the bucket are allowed solely from our site.
// (No localhost / no broad *.vercel.app wildcard.) Add a custom domain here later.
const ALLOWED_ORIGINS = ["https://cat-arena.vercel.app"];
const ALLOWED_METHODS = ["GET", "HEAD", "PUT"];
const MAX_AGE_SECONDS = 3600;

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

async function main(): Promise<void> {
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ALLOWED_ORIGINS,
            AllowedMethods: ALLOWED_METHODS,
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: MAX_AGE_SECONDS,
          },
        ],
      },
    }),
  );
  console.log(`CORS applied to bucket "${bucket}" for origins: ${ALLOWED_ORIGINS.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
