import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    catOrg: { count: vi.fn(), create: vi.fn() },
  },
}));

import { Prisma } from "@prisma/client";

import { MAX_ORGS_PER_CAT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { joinByCode } from "@/org/join-by-code";

const CAT_ID = "cat-1";
const JOIN_CODE = "join-code-fixed-000000000";
const ORG = { id: "org-1", slug: "acme-org01" };

const findOrg = vi.mocked(prisma.organization.findUnique);
const countMemberships = vi.mocked(prisma.catOrg.count);
const createMembership = vi.mocked(prisma.catOrg.create);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("joinByCode", () => {
  it("returns invalid_code when the join code resolves to no org", async () => {
    findOrg.mockResolvedValue(null);
    const result = await joinByCode({ catId: CAT_ID, joinCode: JOIN_CODE });
    expect(result).toEqual({ ok: false, reason: "invalid_code" });
    expect(createMembership).not.toHaveBeenCalled();
  });

  it("returns cap_reached when the cat is already at MAX_ORGS_PER_CAT", async () => {
    findOrg.mockResolvedValue(ORG as never);
    countMemberships.mockResolvedValue(MAX_ORGS_PER_CAT);
    const result = await joinByCode({ catId: CAT_ID, joinCode: JOIN_CODE });
    expect(result).toEqual({ ok: false, reason: "cap_reached" });
    expect(createMembership).not.toHaveBeenCalled();
  });

  it("returns already_member when the membership already exists", async () => {
    findOrg.mockResolvedValue(ORG as never);
    countMemberships.mockResolvedValue(0);
    createMembership.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const result = await joinByCode({ catId: CAT_ID, joinCode: JOIN_CODE });
    expect(result).toEqual({ ok: false, reason: "already_member" });
  });

  it("creates a CatOrg membership and returns orgId + orgSlug on success", async () => {
    findOrg.mockResolvedValue(ORG as never);
    countMemberships.mockResolvedValue(1);
    createMembership.mockResolvedValue({} as never);

    const result = await joinByCode({ catId: CAT_ID, joinCode: JOIN_CODE });

    expect(result).toEqual({ ok: true, orgId: "org-1", orgSlug: "acme-org01" });
    expect(createMembership).toHaveBeenCalledWith({
      data: { catId: CAT_ID, orgId: "org-1" },
    });
  });
});
