import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { catImageLoader } from "@/lib/cat-image-loader";

describe("catImageLoader", () => {
  it("returns an already-absolute CDN url unchanged", () => {
    expect(catImageLoader({ src: "https://cdn.test/cats/x/card.webp", width: 800 })).toBe(
      "https://cdn.test/cats/x/card.webp",
    );
  });

  it("resolves a bare r2 key through publicUrl", () => {
    expect(catImageLoader({ src: "cats/x/card.webp", width: 800 })).toBe(
      "https://cdn.test/cats/x/card.webp",
    );
  });
});
