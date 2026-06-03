import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { cat: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { pickPair } from "@/pairing/pick-pair";

const ORG_ID = "org-1";
const VOTER_KEY = "anon-123";
const A_ROW = { id: "a", rating: 1500, rd: 350, score: 800, timesShown: 0 };
const B_ROW = { id: "b", rating: 1500, rd: 90, score: 820, timesShown: 5 };

const findMany = vi.mocked(prisma.cat.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pickPair org scope only returns members", () => {
  it("filters both candidate pools to the org's members and an APPROVED image", async () => {
    findMany
      .mockResolvedValueOnce([A_ROW] as never)
      .mockResolvedValueOnce([A_ROW, B_ROW] as never);

    const result = await pickPair({
      scope: { orgId: ORG_ID },
      seenCatIds: [],
      voterKey: VOTER_KEY,
    });

    expect(result?.a.id).toBe("a");
    expect(result?.b.id).toBe("b");

    const aArgs = findMany.mock.calls[0]?.[0];
    const bArgs = findMany.mock.calls[1]?.[0];
    expect(aArgs?.where?.orgs?.some?.orgId).toBe(ORG_ID);
    expect(aArgs?.where?.status).toBe("ACTIVE");
    expect(aArgs?.where?.images?.some?.status).toBe("APPROVED");
    expect(bArgs?.where?.orgs?.some?.orgId).toBe(ORG_ID);
  });

  it("returns null when the org has no eligible members", async () => {
    findMany.mockResolvedValue([] as never);
    const result = await pickPair({
      scope: { orgId: ORG_ID },
      seenCatIds: [],
      voterKey: VOTER_KEY,
    });
    expect(result).toBeNull();
  });
});
