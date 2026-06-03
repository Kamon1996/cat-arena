import { beforeEach, describe, expect, it, vi } from "vitest";

const findOrg = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { organization: { findUnique: (...a: unknown[]) => findOrg(...a) } },
}));
// The page module imports `@/auth` (real config reads env at load) for the
// default component; mock it so importing the module to test generateMetadata
// is env-independent.
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { generateMetadata } from "@/app/org/[slug]/page";
import { ORG_MIN_INDEXABLE_MEMBERS } from "@/lib/constants";

const SLUG = "acme-org01";
const ctx = { params: Promise.resolve({ slug: SLUG }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("org page indexing rule", () => {
  it("noindex when the org has fewer than ORG_MIN_INDEXABLE_MEMBERS members", async () => {
    findOrg.mockResolvedValue({
      name: "Acme",
      description: null,
      _count: { members: ORG_MIN_INDEXABLE_MEMBERS - 1 },
    });
    const meta = await generateMetadata(ctx);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("indexable when the org has at least ORG_MIN_INDEXABLE_MEMBERS members", async () => {
    findOrg.mockResolvedValue({
      name: "Acme",
      description: "Cats",
      _count: { members: ORG_MIN_INDEXABLE_MEMBERS },
    });
    const meta = await generateMetadata(ctx);
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("returns a not-found title when the org does not exist", async () => {
    findOrg.mockResolvedValue(null);
    const meta = await generateMetadata(ctx);
    expect(meta.title).toMatch(/not found/i);
  });
});
