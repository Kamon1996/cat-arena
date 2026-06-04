import { describe, expect, it } from "vitest";

import { SITE_URL } from "@/lib/constants";
import { absoluteUrl, catPath, orgPath } from "@/lib/site";

describe("site urls", () => {
  it("builds absolute urls and normalizes the leading slash", () => {
    expect(absoluteUrl("/top")).toBe(`${SITE_URL}/top`);
    expect(absoluteUrl("top")).toBe(`${SITE_URL}/top`);
  });

  it("composes cat and org canonical paths", () => {
    expect(catPath("fluffy-abc123")).toBe("/cat/fluffy-abc123");
    expect(orgPath("acme-cats")).toBe("/org/acme-cats");
    expect(absoluteUrl(catPath("fluffy-abc123"))).toBe(`${SITE_URL}/cat/fluffy-abc123`);
  });
});
