"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteCatImage, deleteCatOwned } from "@/cats/owner-actions";
import { AddImage } from "@/components/dashboard/add-image";
import { RenameCatForm } from "@/components/dashboard/rename-cat-form";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
    if (!window.confirm(`Delete "${cat.name}" and all of its images?`)) {
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
    <Card aria-label={cat.name}>
      <CardHeader>
        <RenameCatForm catId={cat.id} currentName={cat.name} disabled={banned || busy} />
        <CardAction>
          <StatusBadge status={cat.status} />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ul className="grid grid-cols-3 gap-2">
          {cat.images.map((image) => (
            <li
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              {/* biome-ignore lint/performance/noImgElement: R2/CDN thumbnail, not a local asset */}
              <img
                src={image.thumbUrl}
                alt={`${cat.name}`}
                className="h-full w-full object-cover"
              />
              <StatusBadge status={image.status} className="absolute top-1 left-1 shadow-sm" />
              {banned ? null : (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  aria-label="Delete image"
                  disabled={busy}
                  onClick={() => void removeImage(image.id)}
                  className="absolute top-1 right-1 opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>

        {banned ? (
          <p className="text-muted-foreground text-sm">
            This cat is banned and can no longer be edited.
          </p>
        ) : (
          <AddImage catId={cat.id} remaining={remaining} disabled={busy} />
        )}
      </CardContent>

      <CardFooter>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => void removeCat()}
        >
          <Trash2 />
          Delete cat
        </Button>
      </CardFooter>
    </Card>
  );
}
