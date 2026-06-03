import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireModeratorMock, catFindMany } = vi.hoisted(() => ({
  requireModeratorMock: vi.fn(),
  catFindMany: vi.fn(),
}));

vi.mock("@/auth/guards", () => ({ requireModerator: requireModeratorMock }));
vi.mock("@/lib/r2", () => ({ publicUrl: (key: string) => `https://cdn.test/${key}` }));
vi.mock("@/lib/prisma", () => ({ prisma: { cat: { findMany: catFindMany } } }));

import { getModerationCats } from "./moderation-queue";

function makeCat(id: string) {
  return {
    id,
    name: `Cat ${id}`,
    status: "PENDING",
    owner: { id: "u1", name: null, email: "u@x.z", role: "USER", banned: false },
    images: [{ id: `${id}-img` }],
  };
}

describe("getModerationCats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireModeratorMock.mockResolvedValue({ user: { id: "m", role: "MODERATOR" } });
  });

  it("queries cats with pending images and maps thumbUrl", async () => {
    catFindMany.mockResolvedValueOnce([makeCat("a")]);
    const page = await getModerationCats();
    expect(catFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { images: { some: { status: "PENDING" } } },
        take: 11,
      }),
    );
    const arg = catFindMany.mock.calls[0]?.[0] as {
      select: { images: { where: { status: string } } };
    };
    expect(arg.select.images.where).toEqual({ status: "PENDING" });
    expect(page.cats[0]?.images[0]?.thumbUrl).toBe("https://cdn.test/cats/a-img/thumb.webp");
    expect(page.nextCursor).toBeNull();
  });

  it("returns a nextCursor when there is an extra row", async () => {
    const rows = Array.from({ length: 11 }, (_, i) => makeCat(String(i)));
    catFindMany.mockResolvedValueOnce(rows);
    const page = await getModerationCats();
    expect(page.cats).toHaveLength(10);
    expect(page.nextCursor).toBe("9");
  });

  it("passes cursor + skip when a cursor is given", async () => {
    catFindMany.mockResolvedValueOnce([makeCat("z")]);
    await getModerationCats("prev-id");
    expect(catFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "prev-id" }, skip: 1 }),
    );
  });
});
