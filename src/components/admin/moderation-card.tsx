"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import { banUser, setUserRole } from "@/admin/user-actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { catToast } from "@/components/ui/cat-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveAllAction,
  approveImageAction,
  banCatAction,
  deleteCatAction,
  hideCatAction,
  rejectImageAction,
} from "@/moderation/moderation-actions";
import type { ModerationCat } from "@/moderation/moderation-types";

type ModerationCardProps = {
  cat: ModerationCat;
  isAdmin: boolean;
  currentUserId: string;
  onResolved: (catId: string) => void;
  onOwnerResolved: (ownerId: string) => void;
};

const RESOLVE_DELAY_MS = 1200;

type ActionResult = { ok: boolean; error?: string };

export function ModerationCard({
  cat,
  isAdmin,
  currentUserId,
  onResolved,
  onOwnerResolved,
}: ModerationCardProps) {
  const [images, setImages] = useState(cat.images);
  const [busy, setBusy] = useState(false);
  const [doneLabel, setDoneLabel] = useState<string | null>(null);

  function markDone(label: string, resolve: () => void = () => onResolved(cat.id)): void {
    setDoneLabel(label);
    setTimeout(resolve, RESOLVE_DELAY_MS);
  }

  async function run(
    action: Promise<ActionResult>,
    onOk: () => void,
    errPrefix: string,
  ): Promise<void> {
    setBusy(true);
    try {
      const res = await action;
      if (res.ok) {
        onOk();
      } else {
        catToast.error(errPrefix, res.error ? { message: res.error } : undefined);
      }
    } catch {
      catToast.error(errPrefix);
    } finally {
      setBusy(false);
    }
  }

  function resolveImage(imageId: string, doneWord: string): void {
    const next = images.filter((i) => i.id !== imageId);
    setImages(next);
    if (next.length === 0) {
      markDone(doneWord);
    }
  }

  const showUserControls = isAdmin && cat.owner.role !== "ADMIN" && cat.owner.id !== currentUserId;

  return (
    <Card className={doneLabel ? "pointer-events-none opacity-50 transition-opacity" : undefined}>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-lg">{cat.name}</h3>
          <StatusBadge status={cat.status} />
          {doneLabel ? <Badge variant="secondary">{doneLabel}</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
          <span>by {cat.owner.email ?? cat.owner.name ?? "unknown"}</span>
          {showUserControls ? (
            <>
              <Select
                defaultValue={cat.owner.role}
                disabled={busy}
                onValueChange={(v) =>
                  void run(
                    setUserRole(cat.owner.id, v),
                    () => catToast.success("Role updated"),
                    "Role change failed",
                  )
                }
              >
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="MODERATOR">Moderator</SelectItem>
                </SelectContent>
              </Select>
              <ConfirmButton
                label="Ban user"
                title={`Ban ${cat.owner.email ?? "this user"}?`}
                description="Their cats will be deleted. This cannot be undone."
                confirmLabel="Ban user"
                disabled={busy}
                onConfirm={() =>
                  void run(
                    banUser(cat.owner.id),
                    () => markDone("user banned", () => onOwnerResolved(cat.owner.id)),
                    "Ban user failed",
                  )
                }
              />
            </>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image) => (
            <li key={image.id} className="flex flex-col gap-2">
              <div className="aspect-square overflow-hidden rounded-md border bg-muted">
                {/* biome-ignore lint/performance/noImgElement: R2/CDN thumbnail */}
                <img src={image.thumbUrl} alt={cat.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      approveImageAction(image.id),
                      () => resolveImage(image.id, "approved"),
                      "Approve failed",
                    )
                  }
                >
                  <Check />
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      rejectImageAction(image.id),
                      () => resolveImage(image.id, "reviewed"),
                      "Reject failed",
                    )
                  }
                >
                  <X />
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || images.length === 0}
          onClick={() =>
            void run(approveAllAction(cat.id), () => markDone("approved"), "Approve-all failed")
          }
        >
          Approve all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void run(hideCatAction(cat.id), () => markDone("hidden"), "Hide failed")}
        >
          Hide
        </Button>
        <ConfirmButton
          label="Ban cat"
          title={`Ban "${cat.name}"?`}
          description="The cat is removed from duels and the leaderboard."
          confirmLabel="Ban cat"
          disabled={busy}
          onConfirm={() => void run(banCatAction(cat.id), () => markDone("banned"), "Ban failed")}
        />
        <ConfirmButton
          label="Delete cat"
          title={`Delete "${cat.name}"?`}
          description="Permanently deletes the cat and its images."
          confirmLabel="Delete cat"
          disabled={busy}
          onConfirm={() =>
            void run(deleteCatAction(cat.id), () => markDone("deleted"), "Delete failed")
          }
        />
      </CardFooter>
    </Card>
  );
}
