import { Prisma } from "@prisma/client";

import { MAX_ORGS_PER_CAT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const UNIQUE_VIOLATION = "P2002";

export type JoinByCodeInput = {
  catId: string;
  joinCode: string;
};

export type JoinByCodeResult =
  | { ok: true; orgId: string; orgSlug: string }
  | { ok: false; reason: "invalid_code" | "cap_reached" | "already_member" };

/**
 * Join a cat to an organization by invite code. A valid code alone suffices —
 * there is no org-owner approval. Enforces MAX_ORGS_PER_CAT (count CatOrg rows
 * for the cat) and relies on CatOrg's @@id([catId, orgId]) to reject duplicates.
 * New memberships start with the Glicko-2 defaults from the CatOrg schema.
 */
export async function joinByCode(input: JoinByCodeInput): Promise<JoinByCodeResult> {
  const org = await prisma.organization.findUnique({
    where: { joinCode: input.joinCode },
    select: { id: true, slug: true },
  });
  if (!org) {
    return { ok: false, reason: "invalid_code" };
  }

  const memberships = await prisma.catOrg.count({
    where: { catId: input.catId },
  });
  if (memberships >= MAX_ORGS_PER_CAT) {
    return { ok: false, reason: "cap_reached" };
  }

  try {
    await prisma.catOrg.create({
      data: { catId: input.catId, orgId: org.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      return { ok: false, reason: "already_member" };
    }
    throw error;
  }

  return { ok: true, orgId: org.id, orgSlug: org.slug };
}
