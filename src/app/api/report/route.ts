import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getOrCreateAnonId, voterKeyFor } from "@/lib/anon-id";
import { check } from "@/lib/rate-limit";
import { createReport } from "@/moderation/reports";

const MAX_REASON = 500;

const BodySchema = z.object({
  catId: z.string().min(1),
  reason: z.string().max(MAX_REASON).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const session = await auth();
  const anonId = await getOrCreateAnonId();
  const reporter = voterKeyFor(anonId, session?.user?.id ?? null);

  const limit = await check(`report:${reporter}`);
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const result = await createReport({
      catId: parsed.data.catId,
      reporter,
      reason: parsed.data.reason,
    });
    if (!result.ok) {
      return NextResponse.json({ error: "Cat not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
