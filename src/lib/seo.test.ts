import { describe, expect, it } from "vitest";

import { SITE_URL } from "@/lib/constants";
import { catJsonLd, leaderboardJsonLd } from "@/lib/seo";

const CAT = {
  name: "Fluffy",
  slug: "fluffy-abc123",
  images: [
    { url: "https://cdn.test/cats/a/card.webp", width: 800, height: 600 },
    { url: "https://cdn.test/cats/b/card.webp", width: 800, height: 600 },
  ],
};

describe("catJsonLd", () => {
  it("emits an ImageGallery with ImageObject members and a BreadcrumbList", () => {
    const ld = catJsonLd(CAT);
    const graph = ld["@graph"] as Array<Record<string, unknown>>;
    const gallery = graph.find((n) => n["@type"] === "ImageGallery");
    const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList");

    expect(ld["@context"]).toBe("https://schema.org");
    expect(gallery?.name).toBe("Fluffy");
    expect((gallery?.image as unknown[]).length).toBe(2);
    expect((gallery?.image as Array<Record<string, unknown>>)[0]?.["@type"]).toBe("ImageObject");
    expect((crumbs?.itemListElement as Array<Record<string, unknown>>).at(-1)?.item).toBe(
      `${SITE_URL}/cat/fluffy-abc123`,
    );
  });
});

describe("leaderboardJsonLd", () => {
  it("emits an ItemList in rank order", () => {
    const ld = leaderboardJsonLd([
      { name: "A", slug: "a-1" },
      { name: "B", slug: "b-2" },
    ]);
    expect(ld["@type"]).toBe("ItemList");
    const items = ld.itemListElement as Array<Record<string, unknown>>;
    expect(items[0]?.position).toBe(1);
    expect(items[0]?.url).toBe(`${SITE_URL}/cat/a-1`);
    expect(items[1]?.position).toBe(2);
  });
});
