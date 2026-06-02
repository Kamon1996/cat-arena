import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getOrCreateAnonId, voterKeyFor } from "@/lib/anon-id";
import type { ApiError, VoteResponse } from "@/lib/api-types";
import { SCORE } from "@/lib/constants";
import { applyVote } from "@/lib/glicko";
import { consumeNonce } from "@/lib/nonce-store";
import { verifyPairToken } from "@/lib/pair-token";
import { prisma } from "@/lib/prisma";
import { check } from "@/lib/rate-limit";
import { updateGlicko2 } from "@/rating/glicko2";

export const dynamic = "force-dynamic";

const WIN_SCORE = 1;
const LOSS_SCORE = 0;
const DISTINCT_PAIR = 2;

const bodySchema = z.object({
  token: z.string().min(1),
  winnerCatId: z.string().min(1),
  loserCatId: z.string().min(1),
});

function matchesToken(
  payload: { a: string; b: string },
  winnerCatId: string,
  loserCatId: string,
): boolean {
  const pair = new Set([payload.a, payload.b]);
  return (
    pair.size === DISTINCT_PAIR &&
    pair.has(winnerCatId) &&
    pair.has(loserCatId) &&
    winnerCatId !== loserCatId
  );
}

export async function POST(request: Request): Promise<NextResponse<VoteResponse | ApiError>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { token, winnerCatId, loserCatId } = parsed.data;

  const payload = verifyPairToken(token);
  if (!payload || !matchesToken(payload, winnerCatId, loserCatId)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  const session = await auth();
  const anonId = await getOrCreateAnonId();
  const voterKey = voterKeyFor(anonId, session?.user?.id ?? null);

  const limit = await check(voterKey);
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // Single-use: claim the nonce BEFORE the transaction so concurrent replays can't
  // double-apply the vote. Trade-off: if the transaction below fails, the nonce is
  // already burned and this vote cannot be retried with the same token (acceptable —
  // the client simply fetches a new pair). True idempotency is a later concern.
  const fresh = await consumeNonce(payload.nonce);
  if (!fresh) {
    return NextResponse.json({ error: "Token already used" }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ratings = await applyVote(tx, winnerCatId, loserCatId);

      const [winnerOrgs, loserOrgs] = await Promise.all([
        tx.catOrg.findMany({ where: { catId: winnerCatId } }),
        tx.catOrg.findMany({ where: { catId: loserCatId } }),
      ]);
      const loserOrgIds = new Set(loserOrgs.map((row) => row.orgId));
      const sharedWinnerRows = winnerOrgs.filter((row) => loserOrgIds.has(row.orgId));
      const loserByOrg = new Map(loserOrgs.map((row) => [row.orgId, row]));

      for (const winRow of sharedWinnerRows) {
        const loseRow = loserByOrg.get(winRow.orgId);
        if (!loseRow) {
          continue;
        }
        const nextWin = updateGlicko2({ rating: winRow.rating, rd: winRow.rd, vol: winRow.vol }, [
          { rating: loseRow.rating, rd: loseRow.rd, score: WIN_SCORE },
        ]);
        const nextLose = updateGlicko2(
          { rating: loseRow.rating, rd: loseRow.rd, vol: loseRow.vol },
          [{ rating: winRow.rating, rd: winRow.rd, score: LOSS_SCORE }],
        );
        await tx.catOrg.update({
          where: { catId_orgId: { catId: winnerCatId, orgId: winRow.orgId } },
          data: {
            rating: nextWin.rating,
            rd: nextWin.rd,
            vol: nextWin.vol,
            score: SCORE(nextWin.rating, nextWin.rd),
            wins: { increment: 1 },
            timesShown: { increment: 1 },
          },
        });
        await tx.catOrg.update({
          where: { catId_orgId: { catId: loserCatId, orgId: winRow.orgId } },
          data: {
            rating: nextLose.rating,
            rd: nextLose.rd,
            vol: nextLose.vol,
            score: SCORE(nextLose.rating, nextLose.rd),
            losses: { increment: 1 },
            timesShown: { increment: 1 },
          },
        });
      }

      await tx.vote.create({
        data: { winnerCatId, loserCatId, voterKey },
      });

      return ratings;
    });

    return NextResponse.json(
      { ok: true, winner: result.winner, loser: result.loser },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
