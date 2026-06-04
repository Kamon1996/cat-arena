"use client";

import { useRef, useState } from "react";

import { ModerationGalleryRow } from "@/components/admin/moderation-gallery-row";
import { Button } from "@/components/ui/button";
import { getModerationCats } from "@/moderation/moderation-queue";
import type { ModerationCat, ModerationPage } from "@/moderation/moderation-types";

type ModerationListProps = {
  initial: ModerationPage;
  isAdmin: boolean;
  currentUserId: string;
};

export function ModerationList({ initial, isAdmin, currentUserId }: ModerationListProps) {
  const [cats, setCats] = useState<ModerationCat[]>(initial.cats);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A resolved row unmounts, so focus would fall to <body>; park it on the heading.
  function focusHeading(): void {
    headingRef.current?.focus();
  }

  async function loadMore(): Promise<void> {
    if (!cursor || loading) {
      return;
    }
    setLoading(true);
    try {
      const page = await getModerationCats(cursor);
      setCats((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.cats.filter((c) => !seen.has(c.id))];
      });
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  function onResolved(catId: string): void {
    setCats((prev) => prev.filter((c) => c.id !== catId));
    focusHeading();
  }

  // Banning an owner deletes ALL their cats — drop every card by that owner.
  function onOwnerResolved(ownerId: string): void {
    setCats((prev) => prev.filter((c) => c.owner.id !== ownerId));
    focusHeading();
  }

  // A role change keeps the row mounted — patch the owner so the ⋯ menu stays in sync.
  function onOwnerRoleChanged(ownerId: string, role: ModerationCat["owner"]["role"]): void {
    setCats((prev) =>
      prev.map((c) => (c.owner.id === ownerId ? { ...c, owner: { ...c.owner, role } } : c)),
    );
  }

  if (cats.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
        Nothing waiting for review. 🎉
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display font-semibold text-base outline-none"
        >
          Submissions
        </h2>
        <span className="text-muted-foreground text-sm">· oldest first</span>
      </div>
      <div className="flex flex-col gap-3.5">
        {cats.map((cat) => (
          <ModerationGalleryRow
            key={cat.id}
            cat={cat}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onResolved={onResolved}
            onOwnerResolved={onOwnerResolved}
            onOwnerRoleChanged={onOwnerRoleChanged}
          />
        ))}
      </div>
      {cursor ? (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          disabled={loading}
          onClick={() => void loadMore()}
        >
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
