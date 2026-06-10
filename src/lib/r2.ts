import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { PRESIGN_TTL_SECONDS } from "@/lib/constants";
import { env } from "@/lib/env";

let client: S3Client | null = null;

/**
 * Lazily-created S3 client for the configured object-storage endpoint. Lazy so
 * importing this module is side-effect free: `next build` can trace the route
 * graph (and tests can import the helpers) without real S3 credentials present —
 * the client is only built on first actual use. Reused process-wide thereafter.
 */
export function getR2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      // Default to the R2 endpoint; override via S3_ENDPOINT for any S3 provider.
      endpoint: env.S3_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

/** Presigned PUT URL for uploading an object's bytes directly from the browser. */
export async function presignPut(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2(), command, { expiresIn: PRESIGN_TTL_SECONDS });
}

/** Public CDN URL for an R2 object key (e.g. "seed/mittens.webp"). */
export function publicUrl(key: string): string {
  const base = env.R2_PUBLIC_URL.replace(/\/+$/, "");
  return `${base}/${key}`;
}

/**
 * Delete R2 objects by key. Best-effort: storage cleanup must never fail a
 * user-facing DB mutation, so send errors are swallowed (objects may orphan).
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  try {
    await getR2().send(
      new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  } catch {
    // Orphaned objects are acceptable; the user action already succeeded.
  }
}

export type ListedObject = { key: string; lastModified?: Date };

const LIST_PAGE_MAX = 1000; // S3/R2 ListObjectsV2 per-page cap

/** List up to `maxKeys` objects under a key prefix, following continuation
 *  tokens across pages — a single-page list silently re-scans the same first
 *  page forever once the prefix outgrows it. Used by the orphan-cleanup cron. */
export async function listKeys(prefix: string, maxKeys: number): Promise<ListedObject[]> {
  const collected: ListedObject[] = [];
  let continuationToken: string | undefined;

  while (collected.length < maxKeys) {
    const res = await getR2().send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET,
        Prefix: prefix,
        MaxKeys: Math.min(LIST_PAGE_MAX, maxKeys - collected.length),
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      }),
    );
    for (const o of res.Contents ?? []) {
      if (!o.Key) {
        continue;
      }
      // Omit lastModified when absent (exactOptionalPropertyTypes: no explicit undefined).
      collected.push(
        o.LastModified ? { key: o.Key, lastModified: o.LastModified } : { key: o.Key },
      );
    }
    if (!res.IsTruncated || !res.NextContinuationToken) {
      break;
    }
    continuationToken = res.NextContinuationToken;
  }
  return collected;
}
