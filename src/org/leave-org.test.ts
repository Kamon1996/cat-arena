import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { catOrg: { delete: vi.fn() } },
}));

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { leaveOrg } from "@/org/leave-org";

const CAT_ID = "cat-1";
const ORG_ID = "org-1";
const deleteMembership = vi.mocked(prisma.catOrg.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("leaveOrg", () => {
  it("deletes the membership and returns ok", async () => {
    deleteMembership.mockResolvedValue({} as never);
    const result = await leaveOrg({ catId: CAT_ID, orgId: ORG_ID });
    expect(result).toEqual({ ok: true });
    expect(deleteMembership).toHaveBeenCalledWith({
      where: { catId_orgId: { catId: CAT_ID, orgId: ORG_ID } },
    });
  });

  it("returns not_found when the membership does not exist", async () => {
    deleteMembership.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("missing", {
        code: "P2025",
        clientVersion: "test",
      }),
    );
    const result = await leaveOrg({ catId: CAT_ID, orgId: ORG_ID });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
