import { revalidatePath } from "next/cache";

import { requireModerator } from "@/auth/guards";
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
    <section aria-labelledby="moderation-heading">
      <h2 id="moderation-heading">Pending images ({images.length})</h2>
      <ul>
        {images.map((image) => (
          <li key={image.id}>
            {/* biome-ignore lint/performance/noImgElement: R2/CDN asset on an internal admin page */}
            <img src={thumbUrl(image.id)} alt={`Pending ${image.cat.name}`} width={120} />
            <span>{image.cat.name}</span>
            <form action={approveAction}>
              <input type="hidden" name="imageId" value={image.id} />
              <button type="submit">Approve</button>
            </form>
            <form action={rejectAction}>
              <input type="hidden" name="imageId" value={image.id} />
              <button type="submit">Reject</button>
            </form>
            <form action={hideAction}>
              <input type="hidden" name="catId" value={image.catId} />
              <button type="submit">Hide cat</button>
            </form>
            <form action={banAction}>
              <input type="hidden" name="catId" value={image.catId} />
              <button type="submit">Ban cat</button>
            </form>
            <form action={deleteAction}>
              <input type="hidden" name="catId" value={image.catId} />
              <button type="submit">Delete cat</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
