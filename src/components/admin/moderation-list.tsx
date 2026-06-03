"use client";

import { useState } from "react";

import { ModerationCard } from "@/components/admin/moderation-card";
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
      <div className="grid gap-4 lg:grid-cols-2">
        {cats.map((cat) => (
          <ModerationCard
            key={cat.id}
            cat={cat}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onResolved={onResolved}
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
