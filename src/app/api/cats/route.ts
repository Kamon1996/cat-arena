import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { MAX_CATS_PER_USER, MAX_IMAGES_PER_CAT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { slug } from "@/lib/slug";
import { ingestImage } from "@/storage/ingest-image";

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

  const owned = await prisma.cat.count({ where: { ownerId: userId } });
  if (owned >= MAX_CATS_PER_USER) {
    return NextResponse.json({ error: "Cat limit reached" }, { status: 409 });
  }

  try {
    // Process + screen each image OUTSIDE any DB transaction (heavy I/O).
    const processed = await Promise.all(
      images.map(async (img, index) => {
        const id = imageIdFromKey(img.r2Key);
        const { width, height, status, catConfidence } = await ingestImage(id);
        return { id, r2Key: img.r2Key, width, height, position: index, status, catConfidence };
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
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
