import { NextResponse } from "next/server";

import { authorizeCron } from "@/lib/cron-auth";
import { cleanupOrphanImages } from "@/storage/cleanup-orphans";

// Weekly orphan-image cleanup. Trigger from a system crontab / Vercel Cron:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/cleanup
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizeCron(request);
  if (!auth.ok) {
    const error = auth.status === 503 ? "cron disabled (no CRON_SECRET)" : "unauthorized";
    return NextResponse.json({ error }, { status: auth.status });
  }
  const result = await cleanupOrphanImages();
  return NextResponse.json({ ok: true, ...result });
}
