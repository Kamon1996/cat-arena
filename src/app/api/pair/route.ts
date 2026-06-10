import { randomBytes } from "node:crypto";
import { CatStatus, ImageStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getOrCreateAnonId, voterKeyFor } from "@/lib/anon-id";
import type { ApiError, PairBatchResponse, PairCat, PairResponse } from "@/lib/api-types";
import {
  PAIR_BATCH_MAX,
  PAIR_TOKEN_TTL_SECONDS,
  SEEN_COOKIE,
  SEEN_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/constants";
import { signPairToken } from "@/lib/pair-token";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/r2";
import { checkPairServe } from "@/lib/rate-limit";
import { type PairScope, pickPair } from "@/pairing/pick-pair";
import { appendSeen, decodeSeen, encodeSeen } from "@/pairing/seen-buffer";

export const dynamic = "force-dynamic";

const NONCE_BYTES = 12;
const MILLIS_PER_SECOND = 1000;
const DEFAULT_PAIR_COUNT = 1;

const querySchema = z.object({
  scope: z.string().min(1).optional(),
  count: z.coerce.number().int().min(1).max(PAIR_BATCH_MAX).default(DEFAULT_PAIR_COUNT),
});

function resolveScope(raw: string | undefined): {
  scope: PairScope;
  tokenScope: string;
} {
  if (!raw || raw === "global") {
    return { scope: "global", tokenScope: "global" };
  }
  return { scope: { orgId: raw }, tokenScope: `org:${raw}` };
}

async function loadCat(id: string): Promise<PairCat | null> {
  const cat = await prisma.cat.findFirst({
    // Re-check status: a cat could be hidden/banned between pickPair and this load.
    where: { id, status: CatStatus.ACTIVE },
    select: {
      id: true,
      name: true,
      slug: true,
      images: {
        where: { status: ImageStatus.APPROVED },
        orderBy: { position: "asc" },
        select: { r2Key: true, width: true, height: true, position: true },
      },
    },
  });
  if (!cat) {
    return null;
  }
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    images: cat.images.map((img) => ({
      url: publicUrl(img.r2Key),
      width: img.width,
      height: img.height,
      position: img.position,
    })),
  };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<PairBatchResponse | ApiError>> {
  const parsed = querySchema.safeParse({
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
    count: request.nextUrl.searchParams.get("count") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const session = await auth();
  const anonId = await getOrCreateAnonId();
  const voterKey = voterKeyFor(anonId, session?.user?.id ?? null);

  // Bounds pair-token farming: each request is one point regardless of count,
  // so the batch endpoint cannot mint unlimited single-use vote tokens.
  const limit = await checkPairServe(voterKey);
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const jar = await cookies();
  const seenCatIds = decodeSeen(jar.get(SEEN_COOKIE)?.value);
  const { scope, tokenScope } = resolveScope(parsed.data.scope);

  try {
    const pairs: PairResponse[] = [];
    // Cats placed in earlier pairs of this batch (or skipped as unavailable) are
    // hard-excluded from later picks, so a queue of N pairs holds 2N distinct cats.
    const excludedCatIds: string[] = [];

    for (let i = 0; i < parsed.data.count; i += 1) {
      // Snapshot the exclusions per call — the accumulator keeps growing and the
      // callee must not observe (or depend on) later mutations.
      const picked = await pickPair({
        scope,
        seenCatIds,
        voterKey,
        excludedCatIds: [...excludedCatIds],
      });
      if (!picked) {
        break;
      }
      excludedCatIds.push(picked.a.id, picked.b.id);

      const [a, b] = await Promise.all([loadCat(picked.a.id), loadCat(picked.b.id)]);
      if (!a || !b) {
        // A cat got hidden between pick and load; its ids stay excluded above so
        // the next iteration cannot pick the same dead pair again.
        continue;
      }

      const exp = Math.floor(Date.now() / MILLIS_PER_SECOND) + PAIR_TOKEN_TTL_SECONDS;
      const token = signPairToken({
        a: picked.a.id,
        b: picked.b.id,
        nonce: randomBytes(NONCE_BYTES).toString("base64url"),
        exp,
        scope: tokenScope,
      });
      pairs.push({ token, expiresAt: exp * MILLIS_PER_SECOND, a, b });
    }

    if (pairs.length === 0) {
      return NextResponse.json({ error: "No eligible pair available" }, { status: 404 });
    }

    // Persist every cat served in this batch so the next request excludes
    // recently-seen cats — queued-but-unshown pairs count as reserved for this
    // voter (the ring buffer is read at the top of this handler).
    const servedIds = pairs.flatMap((pair) => [pair.a.id, pair.b.id]);
    const nextSeen = appendSeen(seenCatIds, servedIds);
    jar.set(SEEN_COOKIE, encodeSeen(nextSeen), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: SEEN_COOKIE_MAX_AGE_SECONDS,
    });

    return NextResponse.json({ pairs }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
