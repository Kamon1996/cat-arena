import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/anon-id", () => ({
  getOrCreateAnonId: vi.fn(async () => "anon-x"),
  voterKeyFor: (anon: string) => anon,
}));
const verifyPairToken = vi.fn();
vi.mock("@/lib/pair-token", () => ({
  verifyPairToken: (...a: unknown[]) => verifyPairToken(...a),
}));
const check = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ check: (...a: unknown[]) => check(...a) }));
const applyVote = vi.fn();
vi.mock("@/lib/glicko", () => ({ applyVote: (...a: unknown[]) => applyVote(...a) }));
const consumeNonce = vi.fn();
vi.mock("@/lib/nonce-store", () => ({
  consumeNonce: (...a: unknown[]) => consumeNonce(...a),
}));

const WINNER_ID = "ca";
const LOSER_ID = "cb";
const SHARED_ORG_ID = "org-shared";
const UNSHARED_ORG_ID = "org-other";

const tx = {
  catOrg: { findMany: vi.fn(), update: vi.fn() },
  vote: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
}));

import { POST } from "@/app/api/vote/route";

const post = (body: unknown) =>
  POST(
    new Request("http://t/api/vote", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

const VALID = { token: "tok", winnerCatId: WINNER_ID, loserCatId: LOSER_ID };

function orgRow(catId: string, orgId: string) {
  return {
    catId,
    orgId,
    rating: 1500,
    rd: 350,
    vol: 0.06,
    score: 800,
    wins: 0,
    losses: 0,
    draws: 0,
    timesShown: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  check.mockResolvedValue({ ok: true, remaining: 9 });
  consumeNonce.mockResolvedValue(true);
  applyVote.mockResolvedValue({
    winner: { id: WINNER_ID, rating: 1520, rd: 340, score: 840 },
    loser: { id: LOSER_ID, rating: 1480, rd: 340, score: 800 },
  });
  verifyPairToken.mockReturnValue({
    a: WINNER_ID,
    b: LOSER_ID,
    nonce: "n",
    exp: 9e9,
    scope: `org:${SHARED_ORG_ID}`,
  });
  // Winner is in the shared org + an unshared org; loser is only in the shared org.
  tx.catOrg.findMany.mockImplementation(async ({ where }: { where: { catId: string } }) =>
    where.catId === WINNER_ID
      ? [orgRow(WINNER_ID, SHARED_ORG_ID), orgRow(WINNER_ID, UNSHARED_ORG_ID)]
      : [orgRow(LOSER_ID, SHARED_ORG_ID)],
  );
});

describe("POST /api/vote updates CatOrg for a shared org", () => {
  it("updates both shared-org CatOrg rows and skips the unshared org", async () => {
    const res = await post(VALID);
    expect(res.status).toBe(200);

    const updatedKeys = tx.catOrg.update.mock.calls.map((call) => call[0].where.catId_orgId);
    // Exactly the winner + loser rows in the SHARED org are updated.
    expect(updatedKeys).toContainEqual({ catId: WINNER_ID, orgId: SHARED_ORG_ID });
    expect(updatedKeys).toContainEqual({ catId: LOSER_ID, orgId: SHARED_ORG_ID });
    expect(updatedKeys).toHaveLength(2);
    // The unshared org is never touched.
    expect(updatedKeys).not.toContainEqual({
      catId: WINNER_ID,
      orgId: UNSHARED_ORG_ID,
    });
    // The winner's shared-org row increments its win count.
    const winnerUpdate = tx.catOrg.update.mock.calls.find(
      (call) =>
        call[0].where.catId_orgId.catId === WINNER_ID &&
        call[0].where.catId_orgId.orgId === SHARED_ORG_ID,
    );
    expect(winnerUpdate?.[0].data.wins).toEqual({ increment: 1 });
  });
});
