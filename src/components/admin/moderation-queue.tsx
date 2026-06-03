import { Check, X } from "lucide-react";
import { revalidatePath } from "next/cache";

import { requireModerator } from "@/auth/guards";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { approveImage, banCat, deleteCat, hideCat, rejectImage } from "@/moderation/admin-actions";
import { thumbUrl } from "@/storage/keys";

const ADMIN_PATH = "/admin";
const QUEUE_LIMIT = 50;

async function approveAction(formData: FormData): Promise<void> {
  "use server";
  await requireModerator();
  await approveImage(String(formData.get("imageId")));
  revalidatePath(ADMIN_PATH);
}

async function rejectAction(formData: FormData): Promise<void> {
  "use server";
  await requireModerator();
  await rejectImage(String(formData.get("imageId")));
  revalidatePath(ADMIN_PATH);
}

async function hideAction(formData: FormData): Promise<void> {
  "use server";
  await requireModerator();
  await hideCat(String(formData.get("catId")));
  revalidatePath(ADMIN_PATH);
}

async function banAction(formData: FormData): Promise<void> {
  "use server";
  await requireModerator();
  await banCat(String(formData.get("catId")));
  revalidatePath(ADMIN_PATH);
}

async function deleteAction(formData: FormData): Promise<void> {
  "use server";
  await requireModerator();
  await deleteCat(String(formData.get("catId")));
  revalidatePath(ADMIN_PATH);
}

export async function ModerationQueue() {
  const images = await prisma.catImage.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: QUEUE_LIMIT,
    select: {
      id: true,
      catId: true,
      cat: { select: { name: true, status: true } },
    },
  });

  return (
    <section aria-labelledby="moderation-heading" className="flex flex-col gap-4">
      <h2 id="moderation-heading" className="flex items-center gap-2 font-semibold text-lg">
        Pending images
        <Badge variant="secondary">{images.length}</Badge>
      </h2>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          Nothing waiting for review. 🎉
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {images.map((image) => (
            <li key={image.id} className="flex items-center gap-4 rounded-lg border p-3">
              {/* biome-ignore lint/performance/noImgElement: R2/CDN asset on an internal admin page */}
              <img
                src={thumbUrl(image.id)}
                alt={image.cat.name}
                className="size-20 shrink-0 rounded-md border bg-muted object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{image.cat.name}</span>
                  <StatusBadge status={image.cat.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={approveAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <Button type="submit" size="sm">
                      <Check />
                      Approve
                    </Button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <Button type="submit" size="sm" variant="outline">
                      <X />
                      Reject
                    </Button>
                  </form>
                  <form action={hideAction}>
                    <input type="hidden" name="catId" value={image.catId} />
                    <Button type="submit" size="sm" variant="secondary">
                      Hide cat
                    </Button>
                  </form>
                  <form action={banAction}>
                    <input type="hidden" name="catId" value={image.catId} />
                    <Button type="submit" size="sm" variant="destructive">
                      Ban cat
                    </Button>
                  </form>
                  <form action={deleteAction}>
                    <input type="hidden" name="catId" value={image.catId} />
                    <Button type="submit" size="sm" variant="destructive">
                      Delete cat
                    </Button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
