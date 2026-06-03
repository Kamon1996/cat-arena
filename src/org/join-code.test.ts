import { describe, expect, it } from "vitest";

import { ORG_JOIN_CODE_LENGTH } from "@/lib/constants";
import { generateJoinCode } from "@/org/join-code";

const URL_SAFE = /^[A-Za-z0-9_-]+$/;
const SAMPLE_COUNT = 1000;

describe("generateJoinCode", () => {
  it("produces a code of the configured length", () => {
    expect(generateJoinCode()).toHaveLength(ORG_JOIN_CODE_LENGTH);
  });

  it("produces a URL-safe alphabet only", () => {
    expect(generateJoinCode()).toMatch(URL_SAFE);
  });

  it("produces distinct codes across many draws", () => {
    const codes = new Set(
      Array.from({ length: SAMPLE_COUNT }, () => generateJoinCode()),
    );
    expect(codes.size).toBe(SAMPLE_COUNT);
  });
});
