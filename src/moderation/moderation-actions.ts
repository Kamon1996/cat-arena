"use server";

import { requireModerator } from "@/auth/guards";
import {
  approveCatImages,
  approveImage,
  banCat,
  deleteCat,
  hideCat,
  rejectImage,
} from "@/moderation/admin-actions";

export type ModResult = { ok: true } | { ok: false; error: string };

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
