import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { organization: { create: vi.fn() } },
}));
vi.mock("@/lib/slug", () => ({ slug: vi.fn(() => "acme-org01") }));
vi.mock("@/org/join-code", () => ({
  generateJoinCode: vi.fn(() => "join-code-fixed-000000000"),
}));

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createOrg } from "@/org/create-org";

const USER_ID = "user-1";
const ORG_NAME = "Acme";
const create = vi.mocked(prisma.organization.create);

function p2002(target: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: [target] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createOrg", () => {
  it("creates an org and returns id, slug, joinCode", async () => {
    create.mockResolvedValue({
      id: "org-1",
      slug: "acme-org01",
      joinCode: "join-code-fixed-000000000",
    } as never);

    const result = await createOrg({ userId: USER_ID, name: ORG_NAME });

    expect(result).toEqual({
      ok: true,
      id: "org-1",
      slug: "acme-org01",
      joinCode: "join-code-fixed-000000000",
    });
    const args = create.mock.calls[0]?.[0] as {
      data: { createdById: string; name: string };
    };
    expect(args.data.createdById).toBe(USER_ID);
    expect(args.data.name).toBe(ORG_NAME);
  });

  it("returns a name-taken conflict when the name is not unique", async () => {
    create.mockRejectedValue(p2002("name"));
    const result = await createOrg({ userId: USER_ID, name: ORG_NAME });
    expect(result).toEqual({ ok: false, reason: "name_taken" });
  });

  it("returns an already-owns-org conflict when the user already created one", async () => {
    create.mockRejectedValue(p2002("createdById"));
    const result = await createOrg({ userId: USER_ID, name: ORG_NAME });
    expect(result).toEqual({ ok: false, reason: "already_owns_org" });
  });
});
