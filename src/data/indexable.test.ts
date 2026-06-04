import { beforeEach, describe, expect, it, vi } from "vitest";

const catFindMany = vi.fn();
const orgFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cat: { findMany: (...a: unknown[]) => catFindMany(...a) },
    organization: { findMany: (...a: unknown[]) => orgFindMany(...a) },
  },
}));

import { getIndexableCatSlugs, getIndexableOrgSlugs } from "@/data/indexable";

describe("indexable loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getIndexableCatSlugs queries ACTIVE cats only and returns their slugs", async () => {
    catFindMany.mockResolvedValue([{ slug: "a" }, { slug: "b" }]);
    const res = await getIndexableCatSlugs();
    expect(catFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACTIVE" } }),
    );
    expect(res).toEqual([{ slug: "a" }, { slug: "b" }]);
  });

  it("getIndexableOrgSlugs keeps only orgs at/above the member threshold (3)", async () => {
    orgFindMany.mockResolvedValue([
      { slug: "big", _count: { members: 3 } },
      { slug: "small", _count: { members: 1 } },
      { slug: "huge", _count: { members: 9 } },
    ]);
    const res = await getIndexableOrgSlugs();
    expect(res).toEqual([{ slug: "big" }, { slug: "huge" }]);
  });
});
