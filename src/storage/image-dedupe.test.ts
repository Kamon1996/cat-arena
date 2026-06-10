import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { catImage: { findFirst } },
}));

import {
  findRepeatedHash,
  isDuplicateImage,
  isSha256UniqueViolation,
  SHA256_HEX_PATTERN,
} from "./image-dedupe";

function p2002(target: unknown): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("unique violation", {
    code: "P2002",
    clientVersion: "6.0.0",
    meta: { target },
  });
}

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SHA256_HEX_PATTERN", () => {
  it("accepts a lowercase 64-char hex digest", () => {
    expect(SHA256_HEX_PATTERN.test(HASH_A)).toBe(true);
  });

  it("rejects uppercase, short, and non-hex strings", () => {
    expect(SHA256_HEX_PATTERN.test("A".repeat(64))).toBe(false);
    expect(SHA256_HEX_PATTERN.test("a".repeat(63))).toBe(false);
    expect(SHA256_HEX_PATTERN.test(`${"a".repeat(63)}z`)).toBe(false);
  });
});

describe("findRepeatedHash", () => {
  it("returns null when all hashes are distinct", () => {
    expect(findRepeatedHash([HASH_A, HASH_B])).toBeNull();
    expect(findRepeatedHash([])).toBeNull();
  });

  it("returns the first hash that repeats", () => {
    expect(findRepeatedHash([HASH_A, HASH_B, HASH_A])).toBe(HASH_A);
  });
});

describe("isDuplicateImage", () => {
  it("returns false without querying for an empty list", async () => {
    await expect(isDuplicateImage([])).resolves.toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns true when a CatImage already stores one of the hashes", async () => {
    findFirst.mockResolvedValueOnce({ id: "img_1" });
    await expect(isDuplicateImage([HASH_A, HASH_B])).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { sha256: { in: [HASH_A, HASH_B] } },
      select: { id: true },
    });
  });

  it("returns false when no row matches", async () => {
    findFirst.mockResolvedValueOnce(null);
    await expect(isDuplicateImage([HASH_A])).resolves.toBe(false);
  });
});

describe("isSha256UniqueViolation", () => {
  it("matches a P2002 targeting sha256 (array or string target)", () => {
    expect(isSha256UniqueViolation(p2002(["sha256"]))).toBe(true);
    expect(isSha256UniqueViolation(p2002("CatImage_sha256_key"))).toBe(true);
  });

  it("ignores P2002 on other unique fields (e.g. slug)", () => {
    expect(isSha256UniqueViolation(p2002(["slug"]))).toBe(false);
  });

  it("ignores non-P2002 and non-Prisma errors", () => {
    const otherCode = new Prisma.PrismaClientKnownRequestError("not found", {
      code: "P2025",
      clientVersion: "6.0.0",
    });
    expect(isSha256UniqueViolation(otherCode)).toBe(false);
    expect(isSha256UniqueViolation(new Error("boom"))).toBe(false);
  });
});
