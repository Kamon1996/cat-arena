import type { CatStatus } from "@prisma/client";
import type { Session } from "next-auth";

import { requireUser } from "@/auth/guards";
import { prisma } from "@/lib/prisma";

export type OwnedCat = {
  id: string;
  ownerId: string;
  status: CatStatus;
};

export type OwnedCatResult =
  | { ok: true; session: Session; cat: OwnedCat }
  | { ok: false; error: "not_found" | "forbidden" };

/**
 * Require a signed-in user (redirects if none) who owns `catId`. Returns a typed
 * result so server actions can surface not_found/forbidden as toasts, not throws.
 */
export async function requireOwnedCat(catId: string): Promise<OwnedCatResult> {
  const session = await requireUser();
  const cat = await prisma.cat.findUnique({
    where: { id: catId },
    select: { id: true, ownerId: true, status: true },
  });
  if (!cat) {
    return { ok: false, error: "not_found" };
  }
  if (cat.ownerId !== session.user.id) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, session, cat };
}
