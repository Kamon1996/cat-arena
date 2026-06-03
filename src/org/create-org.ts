import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { slug } from "@/lib/slug";
import { generateJoinCode } from "@/org/join-code";

const UNIQUE_VIOLATION = "P2002";

export type CreateOrgInput = {
  userId: string;
  name: string;
  description?: string;
  logoR2Key?: string;
};

export type CreateOrgResult =
  | { ok: true; id: string; slug: string; joinCode: string }
  | { ok: false; reason: "name_taken" | "already_owns_org" };

function uniqueTarget(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
    const target = error.meta?.target;
    return Array.isArray(target) ? target.join(",") : String(target ?? "");
  }
  return "";
}

/**
 * Create an Organization for a user. Enforces MAX_ORGS_PER_USER at the DB level
 * via the Organization.createdById @unique constraint, and name uniqueness via
 * the name @unique constraint. Generates a unique joinCode and slug.
 */
export async function createOrg(input: CreateOrgInput): Promise<CreateOrgResult> {
  try {
    const org = await prisma.organization.create({
      data: {
        name: input.name,
        slug: slug(input.name),
        joinCode: generateJoinCode(),
        createdById: input.userId,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.logoR2Key !== undefined ? { logoR2Key: input.logoR2Key } : {}),
      },
      select: { id: true, slug: true, joinCode: true },
    });
    return { ok: true, id: org.id, slug: org.slug, joinCode: org.joinCode };
  } catch (error) {
    const target = uniqueTarget(error);
    if (target.includes("createdById")) {
      return { ok: false, reason: "already_owns_org" };
    }
    if (target.includes("name")) {
      return { ok: false, reason: "name_taken" };
    }
    throw error;
  }
}
