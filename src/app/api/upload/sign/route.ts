import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { checkUploadBurst, checkUploadDaily } from "@/lib/rate-limit";
import { isDuplicateImage, SHA256_HEX_PATTERN } from "@/storage/image-dedupe";
import { buildUploadSign } from "@/storage/upload-sign";

const BodySchema = z.object({
  contentType: z.enum(ALLOWED_UPLOAD_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  // Client-computed digest for an early duplicate check (UX only — the server
  // recomputes the authoritative hash when the image is ingested).
  sha256: z.string().regex(SHA256_HEX_PATTERN).optional(),
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
    // Rate-limit BEFORE the dedupe lookup — the hash check below is also an
    // existence oracle, so probing it must burn the caller's upload budget.
    const burst = await checkUploadBurst(session.user.id);
    if (!burst.ok) {
      return NextResponse.json(
        { error: "Too many uploads — try again in a minute" },
        { status: 429 },
      );
    }
    const daily = await checkUploadDaily(session.user.id);
    if (!daily.ok) {
      return NextResponse.json(
        { error: "Daily upload limit reached — try again tomorrow" },
        { status: 429 },
      );
    }

    // Fail before any bytes are uploaded when the photo is already known.
    if (parsed.data.sha256 && (await isDuplicateImage([parsed.data.sha256]))) {
      return NextResponse.json({ error: "This photo has already been uploaded" }, { status: 409 });
    }
    const { uploadUrl, r2Key } = await buildUploadSign(parsed.data.contentType);
    return NextResponse.json({ uploadUrl, r2Key }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
