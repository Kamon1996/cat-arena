import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Readiness probe for the Docker healthcheck + external uptime monitor
// (Betterstack/Gatus). Pings the DB so a broken DATABASE_URL or a down Postgres
// surfaces as 503, not a false-green. Never cached.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error", db: "down" }, { status: 503 });
  }
}
