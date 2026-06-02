import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/anon-id", () => ({
  getOrCreateAnonId: vi.fn(async () => "anon-x"),
  voterKeyFor: (anon: string) => anon,
}));
vi.mock("@/pairing/pick-pair", () => ({ pickPair: vi.fn() }));
vi.mock("@/lib/pair-token", () => ({
  signPairToken: vi.fn(() => "signed-token"),
}));
vi.mock("@/lib/r2", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (cookieStore.has(n) ? { name: n, value: cookieStore.get(n) } : undefined),
    set: (n: string, v: string) => cookieStore.set(n, v),
  }),
}));

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { cat: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

import { GET } from "@/app/api/pair/route";
import { pickPair } from "@/pairing/pick-pair";

const req = (url: string) => new NextRequest(new URL(url, "http://t"));

describe("GET /api/pair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();
  });

  it("returns 400 for an invalid scope type", async () => {
    const res = await GET(req("http://t/api/pair?scope="));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no pair can be formed", async () => {
    vi.mocked(pickPair).mockResolvedValue(null);
    const res = await GET(req("http://t/api/pair"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with token + two cats and APPROVED images", async () => {
    vi.mocked(pickPair).mockResolvedValue({
      a: { id: "ca", rating: 1500, rd: 350, score: 800, timesShown: 0 },
      b: { id: "cb", rating: 1500, rd: 350, score: 800, timesShown: 0 },
    });
    findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: where.id === "ca" ? "Alpha" : "Bravo",
      slug: `${where.id}-slug`,
      images: [{ r2Key: `${where.id}/orig`, width: 800, height: 600, position: 0 }],
    }));
    const res = await GET(req("http://t/api/pair?scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("signed-token");
    expect(body.a.name).toBe("Alpha");
    expect(body.a.images[0].url).toBe("https://cdn.test/ca/orig");
    expect(body.b.id).toBe("cb");
  });
});
