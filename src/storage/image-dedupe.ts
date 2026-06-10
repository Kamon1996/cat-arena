import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Lowercase hex SHA-256 digest (64 chars) — the wire format for image hashes. */
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

/** True only for a unique violation on CatImage.sha256 — not slug/other uniques. */
export function isSha256UniqueViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target : [target];
  return fields.some((field) => typeof field === "string" && field.includes("sha256"));
}

/** First hash that appears more than once within a single submission, or null. */
export function findRepeatedHash(hashes: string[]): string | null {
  const seen = new Set<string>();
  for (const hash of hashes) {
    if (seen.has(hash)) {
      return hash;
    }
    seen.add(hash);
  }
  return null;
}

/** True when any existing CatImage already stores one of these hashes. */
export async function isDuplicateImage(hashes: string[]): Promise<boolean> {
  if (hashes.length === 0) {
    return false;
  }
  const existing = await prisma.catImage.findFirst({
    where: { sha256: { in: hashes } },
    select: { id: true },
  });
  return existing !== null;
}
