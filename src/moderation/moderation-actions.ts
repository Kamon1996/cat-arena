"use server";

import { z } from "zod";

import { requireModerator } from "@/auth/guards";
import {
  approveCatImages,
  approveImage,
  banCat,
  deleteCat,
  hideCat,
  rejectCatImages,
  rejectImage,
} from "@/moderation/admin-actions";
import { REJECTION_REASONS } from "@/moderation/moderation-types";

export type ModResult = { ok: true } | { ok: false; error: string };

const reasonsSchema = z
  .array(z.enum(REJECTION_REASONS))
  .min(1)
  .max(REJECTION_REASONS.length)
  .transform((reasons) => [...new Set(reasons)]);

async function run(fn: () => Promise<void>): Promise<ModResult> {
  await requireModerator();
  try {
    await fn();
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function approveImageAction(imageId: string): Promise<ModResult> {
  return run(() => approveImage(imageId));
}

export async function rejectImageAction(imageId: string): Promise<ModResult> {
  return run(() => rejectImage(imageId));
}

/** Reject all of a cat's pending images with the moderator's selected reasons. */
export async function rejectCatImagesAction(catId: string, reasons: string[]): Promise<ModResult> {
  const parsed = reasonsSchema.safeParse(reasons);
  if (!parsed.success) {
    return { ok: false, error: "Select at least one reason" };
  }
  return run(() => rejectCatImages(catId, parsed.data));
}

export async function approveAllAction(catId: string): Promise<ModResult> {
  return run(() => approveCatImages(catId));
}

export async function hideCatAction(catId: string): Promise<ModResult> {
  return run(() => hideCat(catId));
}

export async function banCatAction(catId: string): Promise<ModResult> {
  return run(() => banCat(catId));
}

export async function deleteCatAction(catId: string): Promise<ModResult> {
  return run(() => deleteCat(catId));
}
