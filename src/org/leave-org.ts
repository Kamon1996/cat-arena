import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const RECORD_NOT_FOUND = "P2025";

export type LeaveOrgInput = {
  catId: string;
  orgId: string;
};

export type LeaveOrgResult =
  | { ok: true }
  | { ok: false; reason: "not_found" };

/** Remove a cat's membership in an organization. */
export async function leaveOrg(input: LeaveOrgInput): Promise<LeaveOrgResult> {
  try {
    await prisma.catOrg.delete({
      where: { catId_orgId: { catId: input.catId, orgId: input.orgId } },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === RECORD_NOT_FOUND
    ) {
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }
  return { ok: true };
}
