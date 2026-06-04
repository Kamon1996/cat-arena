"use client";

import { Ban, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteCatImage, deleteCatOwned } from "@/cats/owner-actions";
import { AddImage } from "@/components/dashboard/add-image";
import { RenameCatForm } from "@/components/dashboard/rename-cat-form";
import { CatStatChips } from "@/components/dashboard/stat-chips";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { catToast } from "@/components/ui/cat-toast";
import { MAX_IMAGES_PER_CAT } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type CatCardImage = {
  id: string;
  thumbUrl: string;
  status: string;
};

export type CatCardData = {
  id: string;
  name: string;
  status: string;
  rank: number | null;
  score: number;
  rating: number;
  rd: number;
  wins: number;
  losses: number;
  timesShown: number;
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
      catToast.success("Photo removed", { message: "You can add another anytime." });
      router.refresh();
    } else {
      catToast.error("Could not remove photo", { message: result.error });
    }
  }

  async function removeCat(): Promise<void> {
    setBusy(true);
    const result = await deleteCatOwned(cat.id);
    setBusy(false);
    if (result.ok) {
      catToast.success(`${cat.name} deleted`);
      router.refresh();
    } else {
      catToast.error("Could not delete cat", { message: result.error });
    }
  }

  return (
    <article
      aria-label={cat.name}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border-2 border-ink bg-card shadow-sticker-lg",
        banned && "opacity-90",
      )}
    >
      <div className="flex items-center gap-2 p-4 pb-3">
        <RenameCatForm catId={cat.id} currentName={cat.name} disabled={banned || busy} />
        <div className="ml-auto">
          <StatusBadge status={cat.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-4">
        {cat.images.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square overflow-hidden rounded-md border-2 border-ink bg-muted"
          >
            {/* biome-ignore lint/performance/noImgElement: R2/CDN thumbnail, not a local asset */}
            <img src={image.thumbUrl} alt={cat.name} className="size-full object-cover" />
            <StatusBadge status={image.status} mini className="absolute top-1.5 left-1.5" />
            {banned ? null : (
              <button
                type="button"
                aria-label="Delete photo"
                disabled={busy}
                onClick={() => void removeImage(image.id)}
                className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full border-2 border-ink bg-card text-foreground opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40"
              >
                <X className="size-3" aria-hidden />
              </button>
            )}
          </div>
        ))}
        {banned ? null : <AddImage catId={cat.id} remaining={remaining} disabled={busy} />}
      </div>

      <div className="px-4 pt-4">
        <CatStatChips stats={cat} />
      </div>

      {banned ? (
        <div className="mt-auto p-4">
          <div className="flex items-center gap-2 rounded-md border-2 border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            <Ban className="size-4 shrink-0" aria-hidden />
            This cat was removed for breaking the rules and is now read-only.
          </div>
        </div>
      ) : (
        <div className="mt-auto flex justify-end p-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-destructive hover:bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] hover:text-destructive"
              >
                <Trash2 />
                Delete cat
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {cat.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all of {cat.name}'s photos and rating. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep cat</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void removeCat()}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </article>
  );
}
