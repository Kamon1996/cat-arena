import { CatStatus } from "@prisma/client";

import { ORG_MIN_INDEXABLE_MEMBERS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type IndexableEntry = {
  slug: string;
};

/** Slugs of all ACTIVE cats (for the sitemap). PENDING/HIDDEN/BANNED excluded. */
export async function getIndexableCatSlugs(): Promise<IndexableEntry[]> {
  return prisma.cat.findMany({
    where: { status: CatStatus.ACTIVE },
    orderBy: { score: "desc" },
    select: { slug: true },
  });
}

/** Slugs of orgs with >= ORG_MIN_INDEXABLE_MEMBERS members (avoid thin pages). */
export async function getIndexableOrgSlugs(): Promise<IndexableEntry[]> {
  const orgs = await prisma.organization.findMany({
    select: { slug: true, _count: { select: { members: true } } },
  });
  return orgs
    .filter((org) => org._count.members >= ORG_MIN_INDEXABLE_MEMBERS)
    .map((org) => ({ slug: org.slug }));
}
