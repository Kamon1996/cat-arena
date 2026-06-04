import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { buildUploadSign } from "@/storage/upload-sign";

const BodySchema = z.object({
  contentType: z.enum(ALLOWED_UPLOAD_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content type or size" }, { status: 400 });
  }

  try {
    const { uploadUrl, r2Key } = await buildUploadSign(parsed.data.contentType);
    return NextResponse.json({ uploadUrl, r2Key }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
