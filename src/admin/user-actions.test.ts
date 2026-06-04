import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  deleteObjectsMock,
  userFindUnique,
  userUpdate,
  catImageFindMany,
  catDeleteMany,
  bannedUpsert,
  bannedDeleteMany,
  sessionDeleteMany,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  deleteObjectsMock: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  catImageFindMany: vi.fn(),
  catDeleteMany: vi.fn(),
  bannedUpsert: vi.fn(),
  bannedDeleteMany: vi.fn(),
  sessionDeleteMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/guards", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/r2", () => ({ deleteObjects: deleteObjectsMock, publicUrl: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate },
    catImage: { findMany: catImageFindMany },
    cat: { deleteMany: catDeleteMany },
    bannedEmail: { upsert: bannedUpsert, deleteMany: bannedDeleteMany },
    session: { deleteMany: sessionDeleteMany },
  },
}));

import { banUser, setUserRole, unbanUser } from "./user-actions";

const ADMIN = { user: { id: "admin_1", role: "ADMIN" }, expires: "2999-01-01" };

describe("admin user-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(ADMIN);
    userFindUnique.mockResolvedValue({ id: "u1", email: "u@x.z", role: "USER" });
    catImageFindMany.mockResolvedValue([{ id: "img_a" }]);
  });

  describe("banUser", () => {
    it("blacklists email, deletes cats + R2, drops sessions, flags user", async () => {
      const res = await banUser("u1");
      expect(res).toEqual({ ok: true });
      expect(deleteObjectsMock).toHaveBeenCalledWith([
        "cats/img_a/original",
        "cats/img_a/thumb.webp",
        "cats/img_a/card.webp",
      ]);
      expect(catDeleteMany).toHaveBeenCalledWith({ where: { ownerId: "u1" } });
      expect(bannedUpsert).toHaveBeenCalledWith({
        where: { email: "u@x.z" },
        create: { email: "u@x.z", bannedById: "admin_1" },
        update: { bannedById: "admin_1" },
      });
      expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { banned: true, bannedAt: expect.any(Date) },
      });
    });

    it("refuses to ban yourself", async () => {
      const res = await banUser("admin_1");
      expect(res).toEqual({ ok: false, error: "self" });
      expect(catDeleteMany).not.toHaveBeenCalled();
    });

    it("refuses to ban an ADMIN", async () => {
      userFindUnique.mockResolvedValueOnce({ id: "u1", email: "a@x.z", role: "ADMIN" });
      const res = await banUser("u1");
      expect(res).toEqual({ ok: false, error: "admin" });
      expect(catDeleteMany).not.toHaveBeenCalled();
    });

    it("returns not_found for a missing user", async () => {
      userFindUnique.mockResolvedValueOnce(null);
      const res = await banUser("u1");
      expect(res).toEqual({ ok: false, error: "not_found" });
    });
  });

  describe("unbanUser", () => {
    it("clears blacklist + banned flag", async () => {
      userFindUnique.mockResolvedValueOnce({ email: "u@x.z" });
      const res = await unbanUser("u1");
      expect(res).toEqual({ ok: true });
      expect(bannedDeleteMany).toHaveBeenCalledWith({ where: { email: "u@x.z" } });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { banned: false, bannedAt: null },
      });
    });
  });

  describe("setUserRole", () => {
    it("updates a USER to MODERATOR", async () => {
      const res = await setUserRole("u1", "MODERATOR");
      expect(res).toEqual({ ok: true });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { role: "MODERATOR" },
      });
    });
    it("rejects an invalid role", async () => {
      const res = await setUserRole("u1", "SUPERADMIN");
      expect(res).toEqual({ ok: false, error: "invalid_role" });
    });
    it("refuses to change your own role", async () => {
      const res = await setUserRole("admin_1", "USER");
      expect(res).toEqual({ ok: false, error: "self" });
    });
    it("refuses to change an ADMIN", async () => {
      userFindUnique.mockResolvedValueOnce({ role: "ADMIN" });
      const res = await setUserRole("u1", "USER");
      expect(res).toEqual({ ok: false, error: "admin" });
    });
  });
});
