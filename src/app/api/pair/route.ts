import { randomBytes } from "node:crypto";
import { CatStatus, ImageStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getOrCreateAnonId, voterKeyFor } from "@/lib/anon-id";
import type { ApiError, PairCat, PairResponse } from "@/lib/api-types";
import { PAIR_TOKEN_TTL_SECONDS, SEEN_COOKIE } from "@/lib/constants";
import { signPairToken } from "@/lib/pair-token";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/r2";
import { type PairScope, pickPair } from "@/pairing/pick-pair";
import { decodeSeen } from "@/pairing/seen-buffer";

export const dynamic = "force-dynamic";

const NONCE_BYTES = 12;
const MILLIS_PER_SECOND = 1000;

const querySchema = z.object({
  scope: z.string().min(1).optional(),
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

export async function GET(request: NextRequest): Promise<NextResponse<PairResponse | ApiError>> {
  const parsed = querySchema.safeParse({
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const session = await auth();
  const anonId = await getOrCreateAnonId();
  const voterKey = voterKeyFor(anonId, session?.user?.id ?? null);

  const jar = await cookies();
  const seenCatIds = decodeSeen(jar.get(SEEN_COOKIE)?.value);
  const { scope, tokenScope } = resolveScope(parsed.data.scope);

  try {
    const picked = await pickPair({ scope, seenCatIds, voterKey });
    if (!picked) {
      return NextResponse.json({ error: "No eligible pair available" }, { status: 404 });
    }

    const [a, b] = await Promise.all([loadCat(picked.a.id), loadCat(picked.b.id)]);
    if (!a || !b) {
      return NextResponse.json({ error: "No eligible pair available" }, { status: 404 });
    }

    const token = signPairToken({
      a: picked.a.id,
      b: picked.b.id,
      nonce: randomBytes(NONCE_BYTES).toString("base64url"),
      exp: Math.floor(Date.now() / MILLIS_PER_SECOND) + PAIR_TOKEN_TTL_SECONDS,
      scope: tokenScope,
    });

    return NextResponse.json({ token, a, b }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
