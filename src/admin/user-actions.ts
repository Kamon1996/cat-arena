"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/auth/guards";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/r2";
import { cardKey, originalKey, thumbKey } from "@/storage/keys";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const USERS_PATH = "/admin/users";
const RoleSchema = z.enum(["USER", "MODERATOR"]);

function imageObjectKeys(imageId: string): string[] {
  return [originalKey(imageId), thumbKey(imageId), cardKey(imageId)];
}

export async function banUser(userId: string): Promise<AdminActionResult> {
  const session = await requireAdmin();
  if (userId === session.user.id) {
    return { ok: false, error: "self" };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    return { ok: false, error: "not_found" };
  }
  if (user.role === "ADMIN") {
    return { ok: false, error: "admin" };
  }

  // Best-effort R2 cleanup for every image of every cat the user owns.
  const images = await prisma.catImage.findMany({
    where: { cat: { ownerId: userId } },
    select: { id: true },
  });
  await deleteObjects(images.flatMap((img) => imageObjectKeys(img.id)));

  await prisma.cat.deleteMany({ where: { ownerId: userId } });
  if (user.email) {
    await prisma.bannedEmail.upsert({
      where: { email: user.email },
      create: { email: user.email, bannedById: session.user.id },
      update: { bannedById: session.user.id },
    });
  }
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { banned: true, bannedAt: new Date() },
  });
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function unbanUser(userId: string): Promise<AdminActionResult> {
  await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    return { ok: false, error: "not_found" };
  }
  if (user.email) {
    await prisma.bannedEmail.deleteMany({ where: { email: user.email } });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { banned: false, bannedAt: null },
  });
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function setUserRole(userId: string, role: string): Promise<AdminActionResult> {
  const session = await requireAdmin();
  if (userId === session.user.id) {
    return { ok: false, error: "self" };
  }
  const parsed = RoleSchema.safeParse(role);
  if (!parsed.success) {
    return { ok: false, error: "invalid_role" };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) {
    return { ok: false, error: "not_found" };
  }
  if (user.role === "ADMIN") {
    return { ok: false, error: "admin" };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { role: parsed.data },
  });
  revalidatePath(USERS_PATH);
  return { ok: true };
}
