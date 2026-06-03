import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import type { ApiError } from "@/lib/api-types";
import { ORG_DESCRIPTION_MAX, ORG_NAME_MAX, ORG_NAME_MIN } from "@/lib/constants";
import type { CreateOrgResponse } from "@/lib/org-api-types";
import { createOrg } from "@/org/create-org";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(ORG_NAME_MIN).max(ORG_NAME_MAX),
  description: z.string().trim().max(ORG_DESCRIPTION_MAX).optional(),
  logoR2Key: z.string().min(1).optional(),
});

export async function POST(
  request: Request,
): Promise<NextResponse<CreateOrgResponse | ApiError>> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  try {
    const result = await createOrg({
      userId: session.user.id,
      name: parsed.data.name,
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.logoR2Key !== undefined
        ? { logoR2Key: parsed.data.logoR2Key }
        : {}),
    });

    if (!result.ok) {
      const message =
        result.reason === "already_owns_org"
          ? "You already own an organization"
          : "Organization name is taken";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { id: result.id, slug: result.slug, joinCode: result.joinCode },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
