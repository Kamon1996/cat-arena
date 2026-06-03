"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteCatImage, deleteCatOwned } from "@/cats/owner-actions";
import { AddImage } from "@/components/dashboard/add-image";
import { RenameCatForm } from "@/components/dashboard/rename-cat-form";
import { MAX_IMAGES_PER_CAT } from "@/lib/constants";

export type CatCardImage = {
  id: string;
  thumbUrl: string;
  status: string;
};

export type CatCardData = {
  id: string;
  name: string;
  status: string;
  images: CatCardImage[];
};

export function CatCard({ cat }: { cat: CatCardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const banned = cat.status === "BANNED";
  const remaining = MAX_IMAGES_PER_CAT - cat.images.length;

  async function removeImage(imageId: string): Promise<void> {
    setBusy(true);
    const result = await deleteCatImage(imageId);
    setBusy(false);
    if (result.ok) {
      toast.success("Image removed");
      router.refresh();
    } else {
      toast.error(`Could not remove image (${result.error})`);
    }
  }

  async function removeCat(): Promise<void> {
    if (!window.confirm(`Delete "${cat.name}" and all its images?`)) {
      return;
    }
    setBusy(true);
    const result = await deleteCatOwned(cat.id);
    setBusy(false);
    if (result.ok) {
      toast.success("Cat deleted");
      router.refresh();
    } else {
      toast.error(`Could not delete cat (${result.error})`);
    }
  }

  return (
    <article aria-label={cat.name}>
      <header>
        <RenameCatForm catId={cat.id} currentName={cat.name} disabled={banned || busy} />
        <span>Status: {cat.status}</span>
      </header>

      <ul>
        {cat.images.map((image) => (
          <li key={image.id}>
            {/* biome-ignore lint/performance/noImgElement: R2/CDN thumbnail */}
            <img src={image.thumbUrl} alt={`${cat.name} (${image.status})`} width={120} />
            <span>{image.status}</span>
            <button
              type="button"
              onClick={() => void removeImage(image.id)}
              disabled={banned || busy}
            >
              Delete image
            </button>
          </li>
        ))}
      </ul>

      {!banned ? <AddImage catId={cat.id} remaining={remaining} disabled={busy} /> : null}

      <button type="button" onClick={() => void removeCat()} disabled={busy}>
        Delete cat
      </button>
    </article>
  );
}
