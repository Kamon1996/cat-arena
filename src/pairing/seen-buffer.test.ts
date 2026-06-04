import { describe, expect, it } from "vitest";

import { SEEN_BUFFER_SIZE } from "@/lib/constants";
import { appendSeen, decodeSeen, encodeSeen } from "@/pairing/seen-buffer";

describe("seen-buffer", () => {
  it("round-trips ids through encode/decode", () => {
    const ids = ["a", "b", "c"];
    expect(decodeSeen(encodeSeen(ids))).toEqual(ids);
  });

  it("returns empty array for missing or malformed cookie", () => {
    expect(decodeSeen(undefined)).toEqual([]);
    expect(decodeSeen("not-json")).toEqual([]);
    expect(decodeSeen(encodeSeen([]))).toEqual([]);
  });

  it("appends newest first and caps at SEEN_BUFFER_SIZE", () => {
    const seed = Array.from({ length: SEEN_BUFFER_SIZE }, (_, i) => `id-${i}`);
    const next = appendSeen(seed, ["new-1", "new-2"]);
    expect(next).toHaveLength(SEEN_BUFFER_SIZE);
    expect(next[0]).toBe("new-1");
    expect(next[1]).toBe("new-2");
    expect(next).not.toContain(`id-${SEEN_BUFFER_SIZE - 1}`);
  });

  it("de-duplicates ids already in the buffer", () => {
    const next = appendSeen(["a", "b"], ["a", "c"]);
    expect(next).toEqual(["a", "c", "b"]);
  });
});
