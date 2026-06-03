import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { PRESIGN_TTL_SECONDS } from "@/lib/constants";
import { env } from "@/lib/env";

/** Single S3 client pointed at the Cloudflare R2 S3 endpoint. */
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/** Presigned PUT URL for uploading an object's bytes directly from the browser. */
export async function presignPut(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn: PRESIGN_TTL_SECONDS });
}

/** Public CDN URL for an R2 object key (e.g. "seed/mittens.webp"). */
export function publicUrl(key: string): string {
  const base = env.R2_PUBLIC_URL.replace(/\/+$/, "");
  return `${base}/${key}`;
}
