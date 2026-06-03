import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { bannedEmail: { findUnique } },
}));

import { isEmailBanned } from "./is-email-banned";

describe("isEmailBanned", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false for a null/empty email without hitting the db", async () => {
    expect(await isEmailBanned(null)).toBe(false);
    expect(await isEmailBanned(undefined)).toBe(false);
    expect(await isEmailBanned("")).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns true when the email is blacklisted", async () => {
    findUnique.mockResolvedValueOnce({ id: "b1", email: "x@y.z" });
    expect(await isEmailBanned("x@y.z")).toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { email: "x@y.z" } });
  });

  it("returns false when not blacklisted", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await isEmailBanned("ok@y.z")).toBe(false);
  });
});
