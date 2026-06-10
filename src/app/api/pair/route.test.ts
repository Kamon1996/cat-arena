import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pairServeMock } = vi.hoisted(() => ({ pairServeMock: vi.fn() }));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/anon-id", () => ({
  getOrCreateAnonId: vi.fn(async () => "anon-x"),
  voterKeyFor: (anon: string) => anon,
}));
vi.mock("@/lib/rate-limit", () => ({ checkPairServe: pairServeMock }));
vi.mock("@/pairing/pick-pair", () => ({ pickPair: vi.fn() }));
vi.mock("@/lib/pair-token", () => ({
  signPairToken: vi.fn(() => "signed-token"),
}));
vi.mock("@/lib/r2", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

const cookieStore = new Map<string, string>();
const cookieOptions = new Map<string, Record<string, unknown>>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (cookieStore.has(n) ? { name: n, value: cookieStore.get(n) } : undefined),
    set: (n: string, v: string, opts?: Record<string, unknown>) => {
      cookieStore.set(n, v);
      if (opts) {
        cookieOptions.set(n, opts);
      }
    },
  }),
}));

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { cat: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

import { GET } from "@/app/api/pair/route";
import { SEEN_COOKIE } from "@/lib/constants";
import { pickPair } from "@/pairing/pick-pair";
import { decodeSeen } from "@/pairing/seen-buffer";

const req = (url: string) => new NextRequest(new URL(url, "http://t"));

const candidate = (id: string) => ({ id, rating: 1500, rd: 350, score: 800, timesShown: 0 });

function mockLoadableCats() {
  findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    name: where.id === "ca" ? "Alpha" : "Bravo",
    slug: `${where.id}-slug`,
    images: [{ r2Key: `${where.id}/orig`, width: 800, height: 600, position: 0 }],
  }));
}

describe("GET /api/pair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();
    cookieOptions.clear();
    pairServeMock.mockResolvedValue({ ok: true, remaining: 29 });
  });

  it("returns 400 for an invalid scope type", async () => {
    const res = await GET(req("http://t/api/pair?scope="));
    expect(res.status).toBe(400);
  });

  it("returns 429 when the voter's pair budget is exhausted, before any pick", async () => {
    pairServeMock.mockResolvedValueOnce({ ok: false, remaining: 0 });
    const res = await GET(req("http://t/api/pair?count=5"));
    expect(res.status).toBe(429);
    expect(vi.mocked(pickPair)).not.toHaveBeenCalled();
  });

  it("returns 400 for an out-of-range count", async () => {
    expect((await GET(req("http://t/api/pair?count=0"))).status).toBe(400);
    expect((await GET(req("http://t/api/pair?count=99"))).status).toBe(400);
    expect((await GET(req("http://t/api/pair?count=abc"))).status).toBe(400);
  });

  it("returns 404 when no pair can be formed", async () => {
    vi.mocked(pickPair).mockResolvedValue(null);
    const res = await GET(req("http://t/api/pair"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with one pair (token, expiresAt, cats) by default", async () => {
    vi.mocked(pickPair).mockResolvedValue({ a: candidate("ca"), b: candidate("cb") });
    mockLoadableCats();

    const res = await GET(req("http://t/api/pair?scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pairs).toHaveLength(1);
    expect(body.pairs[0].token).toBe("signed-token");
    expect(body.pairs[0].expiresAt).toBeGreaterThan(Date.now());
    expect(body.pairs[0].a.name).toBe("Alpha");
    expect(body.pairs[0].a.images[0].url).toBe("https://cdn.test/ca/orig");
    expect(body.pairs[0].b.id).toBe("cb");
  });

  it("serves a batch of distinct pairs, accumulating exclusions between picks", async () => {
    vi.mocked(pickPair)
      .mockResolvedValueOnce({ a: candidate("c1"), b: candidate("c2") })
      .mockResolvedValueOnce({ a: candidate("c3"), b: candidate("c4") })
      .mockResolvedValueOnce({ a: candidate("c5"), b: candidate("c6") });
    mockLoadableCats();

    const res = await GET(req("http://t/api/pair?count=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pairs).toHaveLength(3);

    // Every later pick must hard-exclude the cats already reserved by the batch.
    const calls = vi.mocked(pickPair).mock.calls;
    expect(calls[0]?.[0]?.excludedCatIds).toEqual([]);
    expect(calls[1]?.[0]?.excludedCatIds).toEqual(["c1", "c2"]);
    expect(calls[2]?.[0]?.excludedCatIds).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("returns the partial batch when the pool runs dry mid-batch", async () => {
    vi.mocked(pickPair)
      .mockResolvedValueOnce({ a: candidate("c1"), b: candidate("c2") })
      .mockResolvedValueOnce(null);
    mockLoadableCats();

    const res = await GET(req("http://t/api/pair?count=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pairs).toHaveLength(1);
  });

  it("skips a pair whose cat got hidden between pick and load, keeping it excluded", async () => {
    vi.mocked(pickPair)
      .mockResolvedValueOnce({ a: candidate("dead"), b: candidate("c2") })
      .mockResolvedValueOnce({ a: candidate("c3"), b: candidate("c4") });
    findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "dead"
        ? null
        : {
            id: where.id,
            name: where.id,
            slug: `${where.id}-slug`,
            images: [{ r2Key: `${where.id}/orig`, width: 800, height: 600, position: 0 }],
          },
    );

    const res = await GET(req("http://t/api/pair?count=2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pairs).toHaveLength(1);
    expect(body.pairs[0].a.id).toBe("c3");

    const calls = vi.mocked(pickPair).mock.calls;
    expect(calls[1]?.[0]?.excludedCatIds).toEqual(["dead", "c2"]);
  });

  it("persists every served cat into the seen-buffer cookie", async () => {
    vi.mocked(pickPair)
      .mockResolvedValueOnce({ a: candidate("c1"), b: candidate("c2") })
      .mockResolvedValueOnce({ a: candidate("c3"), b: candidate("c4") });
    mockLoadableCats();

    await GET(req("http://t/api/pair?count=2"));
    expect(decodeSeen(cookieStore.get(SEEN_COOKIE))).toEqual(["c1", "c2", "c3", "c4"]);
    // hardened against accidental client-readable / cross-site cookies
    expect(cookieOptions.get(SEEN_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  });

  it("merges the new pair ahead of previously-seen ids", async () => {
    cookieStore.set(SEEN_COOKIE, JSON.stringify(["cb", "cz"]));
    vi.mocked(pickPair).mockResolvedValue({ a: candidate("ca"), b: candidate("cb") });
    mockLoadableCats();

    await GET(req("http://t/api/pair?scope=global"));
    // newest-first, de-duped: ca, cb (moved up), then the older-unique cz
    expect(decodeSeen(cookieStore.get(SEEN_COOKIE))).toEqual(["ca", "cb", "cz"]);
  });
});
