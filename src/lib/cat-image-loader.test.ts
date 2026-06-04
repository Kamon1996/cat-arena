import { describe, expect, it } from "vitest";

import { catImageLoader } from "@/lib/cat-image-loader";

describe("catImageLoader", () => {
  it("returns the (already absolute) CDN url verbatim — bypasses Vercel optimization", () => {
    expect(catImageLoader({ src: "https://cdn.test/cats/x/card.webp", width: 800 })).toBe(
      "https://cdn.test/cats/x/card.webp",
    );
  });

  it("is client-safe and import-free: passes any src through unchanged", () => {
    expect(catImageLoader({ src: "seed/mittens.webp", width: 200 })).toBe("seed/mittens.webp");
  });
});
