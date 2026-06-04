import { describe, expect, it } from "vitest";

import { slug } from "./slug";

describe("slug", () => {
  it("kebab-cases and lowercases the name with a 6-char suffix", () => {
    expect(slug("Fluffy McWhiskers")).toMatch(/^fluffy-mcwhiskers-[a-z0-9]{6}$/);
  });

  it("strips diacritics and non-alphanumerics", () => {
    expect(slug("Café  Cat!!!")).toMatch(/^cafe-cat-[a-z0-9]{6}$/);
  });

  it("is unique per call", () => {
    expect(slug("Tom")).not.toBe(slug("Tom"));
  });

  it("falls back to just a suffix for names with no alphanumerics", () => {
    expect(slug("!!!")).toMatch(/^[a-z0-9]{6}$/);
  });
});
