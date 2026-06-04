import { describe, expect, it } from "vitest";

import { isAdmin, isStaff } from "@/auth/roles";

describe("isStaff", () => {
  it("is true for MODERATOR and ADMIN (the admin-area audience)", () => {
    expect(isStaff("MODERATOR")).toBe(true);
    expect(isStaff("ADMIN")).toBe(true);
  });

  it("is false for a plain USER", () => {
    expect(isStaff("USER")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("is true only for ADMIN", () => {
    expect(isAdmin("ADMIN")).toBe(true);
  });

  it("is false for MODERATOR and USER", () => {
    expect(isAdmin("MODERATOR")).toBe(false);
    expect(isAdmin("USER")).toBe(false);
  });
});
