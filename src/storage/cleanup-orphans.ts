import "server-only";

import { ORPHAN_GRACE_HOURS, ORPHAN_SCAN_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { deleteObjects, listKeys } from "@/lib/r2";
import { cardKey, originalKey, thumbKey } from "@/storage/keys";

const MS_PER_HOUR = 3_600_000;
const CATS_PREFIX = "cats/";
const ORIGINAL_KEY = /^cats\/([^/]+)\/original$/;

export type CleanupResult = { scanned: number; deletedImages: number };

/**
 * Delete R2 objects for "orphan" images: an `original` was uploaded via presigned
 * URL but POST /api/cats never created the CatImage row (abandoned upload). Only
 * objects older than ORPHAN_GRACE_HOURS are eligible, so in-flight uploads are not
 * reaped. Bounded to one ListObjectsV2 page (ORPHAN_SCAN_LIMIT) per run.
 */
export async function cleanupOrphanImages(now = new Date()): Promise<CleanupResult> {
  const cutoff = new Date(now.getTime() - ORPHAN_GRACE_HOURS * MS_PER_HOUR);
  const objects = await listKeys(CATS_PREFIX, ORPHAN_SCAN_LIMIT);

  // Candidate imageIds: `original` objects older than the grace window.
  const candidateIds: string[] = [];
  for (const obj of objects) {
    const match = ORIGINAL_KEY.exec(obj.key);
    if (!match) {
      continue;
    }
    if (obj.lastModified && obj.lastModified >= cutoff) {
      continue; // too fresh — may be an in-flight upload
    }
    const imageId = match[1];
    if (imageId) {
      candidateIds.push(imageId);
    }
  }
  if (candidateIds.length === 0) {
    return { scanned: objects.length, deletedImages: 0 };
  }

  const existing = await prisma.catImage.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));
  const orphanIds = candidateIds.filter((id) => !existingIds.has(id));

  const keysToDelete = orphanIds.flatMap((id) => [originalKey(id), thumbKey(id), cardKey(id)]);
  await deleteObjects(keysToDelete);

  return { scanned: objects.length, deletedImages: orphanIds.length };
}
