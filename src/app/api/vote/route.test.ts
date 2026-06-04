import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerify, mockCheck, mockApplyVote, mockConsumeNonce, tx } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockCheck: vi.fn(),
  mockApplyVote: vi.fn(),
  mockConsumeNonce: vi.fn(),
  tx: {
    cat: { findMany: vi.fn() },
    catOrg: { findMany: vi.fn(), update: vi.fn() },
    vote: { create: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/anon-id", () => ({
  getOrCreateAnonId: vi.fn(async () => "anon-x"),
  voterKeyFor: (anon: string) => anon,
}));
vi.mock("@/lib/pair-token", () => ({ verifyPairToken: mockVerify }));
vi.mock("@/lib/rate-limit", () => ({ check: mockCheck }));
vi.mock("@/lib/glicko", () => ({ applyVote: mockApplyVote }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
}));
vi.mock("@/lib/nonce-store", () => ({ consumeNonce: mockConsumeNonce }));

import { POST } from "@/app/api/vote/route";

const post = (body: unknown) =>
  POST(
    new Request("http://t/api/vote", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

const valid = { token: "tok", winnerCatId: "ca", loserCatId: "cb" };

describe("POST /api/vote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheck.mockResolvedValue({ ok: true, remaining: 9 });
    mockConsumeNonce.mockResolvedValue(true);
    tx.cat.findMany.mockResolvedValue([
      { id: "ca", status: "ACTIVE" },
      { id: "cb", status: "ACTIVE" },
    ]);
    tx.catOrg.findMany.mockResolvedValue([]);
    mockApplyVote.mockResolvedValue({
      winner: { id: "ca", rating: 1520, rd: 340, score: 840 },
      loser: { id: "cb", rating: 1480, rd: 340, score: 800 },
    });
  });

  it("returns 400 for an invalid body", async () => {
    const res = await post({ token: "tok" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when token is invalid", async () => {
    mockVerify.mockReturnValue(null);
    const res = await post(valid);
    expect(res.status).toBe(403);
  });

  it("returns 403 when token cats do not match the vote", async () => {
    mockVerify.mockReturnValue({ a: "other", b: "cb", nonce: "n", exp: 9e9, scope: "global" });
    const res = await post(valid);
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    mockVerify.mockReturnValue({ a: "ca", b: "cb", nonce: "n", exp: 9e9, scope: "global" });
    mockCheck.mockResolvedValue({ ok: false, remaining: 0 });
    const res = await post(valid);
    expect(res.status).toBe(429);
  });

  it("applies global Glicko-2, inserts the vote, and returns 200", async () => {
    mockVerify.mockReturnValue({ a: "ca", b: "cb", nonce: "n", exp: 9e9, scope: "global" });
    const res = await post(valid);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.winner.id).toBe("ca");
    expect(mockApplyVote).toHaveBeenCalledWith(tx, "ca", "cb");
    expect(tx.vote.create).toHaveBeenCalledOnce();
  });

  it("returns 409 (and skips the rating update) when a cat is no longer ACTIVE", async () => {
    mockVerify.mockReturnValue({ a: "ca", b: "cb", nonce: "n", exp: 9e9, scope: "global" });
    tx.cat.findMany.mockResolvedValue([
      { id: "ca", status: "ACTIVE" },
      { id: "cb", status: "HIDDEN" },
    ]);
    const res = await post(valid);
    expect(res.status).toBe(409);
    expect(mockApplyVote).not.toHaveBeenCalled();
    expect(tx.vote.create).not.toHaveBeenCalled();
  });
});
