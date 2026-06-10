import { NextResponse } from "next/server";

import { authorizeCron } from "@/lib/cron-auth";
import { decayInactiveRatings } from "@/rating/decay";

// Daily RD-decay for inactive cats. Trigger from a system crontab / Vercel Cron:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/decay
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizeCron(request);
  if (!auth.ok) {
    const error = auth.status === 503 ? "cron disabled (no CRON_SECRET)" : "unauthorized";
    return NextResponse.json({ error }, { status: auth.status });
  }
  const result = await decayInactiveRatings();
  return NextResponse.json({ ok: true, ...result });
}
