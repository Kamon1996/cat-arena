import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { cardKey, originalKey, thumbKey } from "./keys";

const IMAGE_ID = "img_abc123";
const ORIGINAL = `cats/${IMAGE_ID}/original`;

describe("r2 keys", () => {
  it("derives the original key from an image id", () => {
    expect(originalKey(IMAGE_ID)).toBe(ORIGINAL);
  });

  it("derives thumb and card keys with the .webp extension", () => {
    expect(thumbKey(IMAGE_ID)).toBe(`cats/${IMAGE_ID}/thumb.webp`);
    expect(cardKey(IMAGE_ID)).toBe(`cats/${IMAGE_ID}/card.webp`);
  });
});
