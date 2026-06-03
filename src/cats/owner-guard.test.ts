import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock, findUniqueMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock("@/auth/guards", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { cat: { findUnique: findUniqueMock } },
}));

import { requireOwnedCat } from "./owner-guard";

const SESSION = { user: { id: "user_1", role: "USER" }, expires: "2999-01-01" };

describe("requireOwnedCat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(SESSION);
  });

  it("returns not_found when the cat does not exist", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const result = await requireOwnedCat("cat_x");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("returns forbidden when the cat belongs to another user", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "cat_1",
      ownerId: "user_2",
      status: "ACTIVE",
    });
    const result = await requireOwnedCat("cat_1");
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("returns ok with the cat when owned by the session user", async () => {
    const cat = { id: "cat_1", ownerId: "user_1", status: "ACTIVE" };
    findUniqueMock.mockResolvedValueOnce(cat);
    const result = await requireOwnedCat("cat_1");
    expect(result).toEqual({ ok: true, session: SESSION, cat });
  });
});
