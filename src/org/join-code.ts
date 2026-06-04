import { randomBytes } from "node:crypto";

import { ORG_JOIN_CODE_LENGTH } from "@/lib/constants";

// base64url uses [A-Za-z0-9_-]; 1 byte yields ~1.33 base64url chars,
// so request enough bytes then slice to the exact length.
const BYTES_PER_CHAR = 1;

/** Generate a long, URL-safe, hard-to-guess organization invite code. */
export function generateJoinCode(): string {
  return randomBytes(ORG_JOIN_CODE_LENGTH * BYTES_PER_CHAR)
    .toString("base64url")
    .slice(0, ORG_JOIN_CODE_LENGTH);
}
