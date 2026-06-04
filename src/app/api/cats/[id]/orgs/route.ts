import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import type { ApiError } from "@/lib/api-types";
import type { JoinOrgResponse, LeaveOrgResponse } from "@/lib/org-api-types";
import { prisma } from "@/lib/prisma";
import { joinByCode } from "@/org/join-by-code";
import { leaveOrg } from "@/org/leave-org";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const joinSchema = z.object({ joinCode: z.string().min(1) });
const leaveSchema = z.object({ orgId: z.string().min(1) });

type OwnerGate = { ok: true; userId: string } | { ok: false; response: NextResponse<ApiError> };

async function ownerGate(catId: string): Promise<OwnerGate> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  const cat = await prisma.cat.findUnique({
    where: { id: catId },
    select: { ownerId: true },
  });
  if (!cat) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Cat not found" }, { status: 404 }),
    };
  }
  if (cat.ownerId !== session.user.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not the cat owner" }, { status: 403 }),
    };
  }
  return { ok: true, userId: session.user.id };
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<JoinOrgResponse | ApiError>> {
  const { id } = await context.params;
  const gate = await ownerGate(id);
  if (!gate.ok) {
    return gate.response;
  }

  const parsed = joinSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await joinByCode({ catId: id, joinCode: parsed.data.joinCode });
    if (!result.ok) {
      if (result.reason === "invalid_code") {
        return NextResponse.json({ error: "Invalid join code" }, { status: 422 });
      }
      const message =
        result.reason === "cap_reached"
          ? "Cat is already in the maximum number of organizations"
          : "Cat is already a member of this organization";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: true, orgId: result.orgId, orgSlug: result.orgSlug },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<LeaveOrgResponse | ApiError>> {
  const { id } = await context.params;
  const gate = await ownerGate(id);
  if (!gate.ok) {
    return gate.response;
  }

  const parsed = leaveSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await leaveOrg({ catId: id, orgId: parsed.data.orgId });
    if (!result.ok) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
