import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { MAX_CATS_PER_USER, MAX_IMAGES_PER_CAT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { checkUploadBurst } from "@/lib/rate-limit";
import { slug } from "@/lib/slug";
import {
  findRepeatedHash,
  isDuplicateImage,
  isSha256UniqueViolation,
} from "@/storage/image-dedupe";
import { ingestImage } from "@/storage/ingest-image";
import { fetchOriginal, sha256OfBuffer } from "@/storage/process-image";

const MIN_NAME = 1;
const MAX_NAME = 60;
const ORIGINAL_KEY = /^cats\/([^/]+)\/original$/;

const BodySchema = z.object({
  name: z.string().trim().min(MIN_NAME).max(MAX_NAME),
  images: z
    .array(z.object({ r2Key: z.string().regex(ORIGINAL_KEY) }))
    .min(1)
    .max(MAX_IMAGES_PER_CAT),
  // Accepted for forward-compat; org-join via joinCode is deferred to phase 07.
  joinCode: z.string().optional(),
});

function imageIdFromKey(r2Key: string): string {
  const id = ORIGINAL_KEY.exec(r2Key)?.[1];
  if (!id) {
    throw new Error("bad key");
  }
  return id;
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body or too many images" }, { status: 400 });
  }
  const { name, images } = parsed.data;

  // Shares the upload-surface budget with /api/upload/sign — a duplicate
  // rejection creates no Cat, so MAX_CATS_PER_USER alone does not bound retries.
  const burst = await checkUploadBurst(userId);
  if (!burst.ok) {
    return NextResponse.json(
      { error: "Too many uploads — try again in a minute" },
      { status: 429 },
    );
  }

  const owned = await prisma.cat.count({ where: { ownerId: userId } });
  if (owned >= MAX_CATS_PER_USER) {
    return NextResponse.json({ error: "Cat limit reached" }, { status: 409 });
  }

  try {
    // Fetch + hash the originals FIRST (one cheap R2 GET each) so size and
    // duplicate violations are rejected BEFORE any sharp encode or Workers AI
    // call burns CPU/quota. The sign-time client hash is UX only — this
    // server-computed hash is the authoritative one. Orphaned R2 originals
    // from rejected submissions are reaped by the cleanup cron.
    const originals = await Promise.all(
      images.map(async (img, index) => {
        const id = imageIdFromKey(img.r2Key);
        const original = await fetchOriginal(id);
        return {
          id,
          r2Key: img.r2Key,
          position: index,
          original,
          sha256: sha256OfBuffer(original),
        };
      }),
    );

    // The presigned PUT does not bind the declared size — check the real bytes.
    if (originals.some((o) => o.original.byteLength > MAX_UPLOAD_BYTES)) {
      return NextResponse.json({ error: "Image exceeds the upload size limit" }, { status: 400 });
    }

    const hashes = originals.map((o) => o.sha256);
    if (findRepeatedHash(hashes) !== null) {
      return NextResponse.json(
        { error: "The same photo was added twice — each photo must be unique" },
        { status: 409 },
      );
    }
    if (await isDuplicateImage(hashes)) {
      return NextResponse.json({ error: "This photo has already been uploaded" }, { status: 409 });
    }

    // Process + screen each image OUTSIDE any DB transaction (heavy I/O).
    const processed = await Promise.all(
      originals.map(async (o) => {
        const { width, height, status, catConfidence, sha256 } = await ingestImage(
          o.id,
          o.original,
        );
        return {
          id: o.id,
          r2Key: o.r2Key,
          width,
          height,
          position: o.position,
          status,
          catConfidence,
          sha256,
        };
      }),
    );

    const created = await prisma.cat.create({
      data: {
        name,
        slug: slug(name),
        ownerId: userId,
        status: "PENDING",
        images: {
          create: processed.map((p) => ({
            id: p.id,
            r2Key: p.r2Key,
            sha256: p.sha256,
            width: p.width,
            height: p.height,
            position: p.position,
            status: p.status,
          })),
        },
      },
      select: { id: true, slug: true, status: true },
    });

    const hasApproved = processed.some((p) => p.status === "APPROVED");
    let status = created.status;
    if (hasApproved) {
      const promoted = await prisma.cat.update({
        where: { id: created.id },
        data: { status: "ACTIVE", approvedAt: new Date() },
        select: { status: true },
      });
      status = promoted.status;
    }

    // Surface per-image auto-screen confidence so the client can log it (no UI, no DB).
    const screens = processed.map((p) => ({
      status: p.status,
      catConfidence: p.catConfidence,
    }));

    return NextResponse.json(
      { id: created.id, slug: created.slug, status, screens },
      { status: 201 },
    );
  } catch (err) {
    // Unique-violation backstop: two concurrent submissions of the same photo
    // can both pass the findFirst check; the @unique(sha256) constraint wins.
    if (isSha256UniqueViolation(err)) {
      return NextResponse.json({ error: "This photo has already been uploaded" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
