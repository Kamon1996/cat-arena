"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwnedCat } from "@/cats/owner-guard";
import { MAX_IMAGES_PER_CAT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/r2";
import { checkUploadBurst } from "@/lib/rate-limit";
import { isDuplicateImage, isSha256UniqueViolation } from "@/storage/image-dedupe";
import { ingestImage } from "@/storage/ingest-image";
import { cardKey, originalKey, thumbKey } from "@/storage/keys";
import { fetchOriginal, sha256OfBuffer } from "@/storage/process-image";

export type OwnerActionResult = { ok: true } | { ok: false; error: string };

const DASHBOARD_PATH = "/dashboard";
const MIN_NAME = 1;
const MAX_NAME = 60;
const NameSchema = z.string().trim().min(MIN_NAME).max(MAX_NAME);
const ORIGINAL_KEY = /^cats\/([^/]+)\/original$/;

/** All three R2 objects (original + derived variants) for one image id. */
function imageObjectKeys(imageId: string): string[] {
  return [originalKey(imageId), thumbKey(imageId), cardKey(imageId)];
}

export async function renameCat(catId: string, name: string): Promise<OwnerActionResult> {
  const owned = await requireOwnedCat(catId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }
  if (owned.cat.status === "BANNED") {
    return { ok: false, error: "banned" };
  }
  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: "invalid_name" };
  }
  // Slug is intentionally NOT regenerated (SEO stability).
  await prisma.cat.update({
    where: { id: catId },
    data: { name: parsed.data },
  });
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

export async function addCatImage(catId: string, r2Key: string): Promise<OwnerActionResult> {
  const owned = await requireOwnedCat(catId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }
  if (owned.cat.status === "BANNED") {
    return { ok: false, error: "banned" };
  }
  const imageId = ORIGINAL_KEY.exec(r2Key)?.[1];
  if (!imageId) {
    return { ok: false, error: "invalid_key" };
  }
  const existing = await prisma.catImage.findMany({
    where: { catId },
    select: { position: true },
  });
  if (existing.length >= MAX_IMAGES_PER_CAT) {
    return { ok: false, error: "image_limit" };
  }
  const position = existing.reduce((max, img) => Math.max(max, img.position), -1) + 1;
  // Shares the upload-surface budget with /api/upload/sign and POST /api/cats.
  const burst = await checkUploadBurst(owned.cat.ownerId);
  if (!burst.ok) {
    return { ok: false, error: "rate_limited" };
  }
  // Fetch + hash first so size and duplicate violations are rejected before
  // any sharp encode or Workers AI call (same order as POST /api/cats).
  const original = await fetchOriginal(imageId);
  if (original.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "too_large" };
  }
  if (await isDuplicateImage([sha256OfBuffer(original)])) {
    return { ok: false, error: "duplicate_image" };
  }
  const { width, height, status, sha256 } = await ingestImage(imageId, original);
  try {
    await prisma.catImage.create({
      data: { id: imageId, catId, r2Key, sha256, width, height, position, status },
    });
  } catch (err) {
    // Race backstop: a concurrent identical upload can pass the check above;
    // the @unique(sha256) constraint settles it.
    if (isSha256UniqueViolation(err)) {
      return { ok: false, error: "duplicate_image" };
    }
    throw err;
  }
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

export async function deleteCatImage(imageId: string): Promise<OwnerActionResult> {
  const image = await prisma.catImage.findUnique({
    where: { id: imageId },
    select: { id: true, catId: true },
  });
  if (!image) {
    return { ok: false, error: "not_found" };
  }
  const owned = await requireOwnedCat(image.catId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }
  if (owned.cat.status === "BANNED") {
    return { ok: false, error: "banned" };
  }
  const count = await prisma.catImage.count({ where: { catId: image.catId } });
  if (count <= 1) {
    return { ok: false, error: "last_image" };
  }
  await prisma.catImage.delete({ where: { id: imageId } });
  await deleteObjects(imageObjectKeys(imageId));
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

export async function deleteCatOwned(catId: string): Promise<OwnerActionResult> {
  const owned = await requireOwnedCat(catId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }
  // Deleting your own cat is allowed in any status, including BANNED.
  const images = await prisma.catImage.findMany({
    where: { catId },
    select: { id: true },
  });
  await prisma.cat.delete({ where: { id: catId } }); // cascades CatImage rows
  await deleteObjects(images.flatMap((img) => imageObjectKeys(img.id)));
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}
