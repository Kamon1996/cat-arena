"use client";

import { Check, MoreHorizontal, X } from "lucide-react";
import { useState } from "react";

import { banUser, setUserRole } from "@/admin/user-actions";
import { ModerationPhotoGrid } from "@/components/admin/moderation-photo-grid";
import { RejectReasonsDialog } from "@/components/admin/reject-reasons-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatCell } from "@/components/ui/cat-cell";
import { catToast } from "@/components/ui/cat-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  approveAllAction,
  banCatAction,
  deleteCatAction,
  hideCatAction,
  rejectCatImagesAction,
} from "@/moderation/moderation-actions";
import type { ModerationCat } from "@/moderation/moderation-types";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const ID_TAIL_LENGTH = 6;

type StatusInfo = { label: string; variant: "warning" | "success" | "destructive"; bar: string };
const STATUS = {
  PENDING: { label: "Pending", variant: "warning", bar: "bg-warning" },
  ACTIVE: { label: "Approved", variant: "success", bar: "bg-success" },
  HIDDEN: { label: "Hidden", variant: "destructive", bar: "bg-destructive" },
  BANNED: { label: "Banned", variant: "destructive", bar: "bg-destructive" },
} satisfies Record<string, StatusInfo>;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < MS_PER_HOUR) {
    return `${Math.max(1, Math.round(diff / MS_PER_MINUTE))} min ago`;
  }
  if (diff < MS_PER_DAY) {
    return `${Math.round(diff / MS_PER_HOUR)} h ago`;
  }
  return `${Math.round(diff / MS_PER_DAY)} d ago`;
}

type ActionResult = { ok: boolean; error?: string };

type Confirm = {
  title: string;
  description: string;
  actionLabel: string;
  run: () => Promise<ActionResult>;
  onOk: () => void;
};

type ModerationGalleryRowProps = {
  cat: ModerationCat;
  isAdmin: boolean;
  currentUserId: string;
  onResolved: (catId: string) => void;
  onOwnerResolved: (ownerId: string) => void;
  onOwnerRoleChanged: (ownerId: string, role: ModerationCat["owner"]["role"]) => void;
};

export function ModerationGalleryRow({
  cat,
  isAdmin,
  currentUserId,
  onResolved,
  onOwnerResolved,
  onOwnerRoleChanged,
}: ModerationGalleryRowProps) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const status = STATUS[cat.status as keyof typeof STATUS] ?? STATUS.PENDING;
  const ownerLabel = cat.owner.name ?? cat.owner.email ?? "unknown";
  const showUserControls = isAdmin && cat.owner.role !== "ADMIN" && cat.owner.id !== currentUserId;

  async function runAction(
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

  return (
    <article
      aria-label={`${cat.name} — ${status.label}`}
      className="group relative flex overflow-hidden rounded-lg border-[1.5px] border-border bg-card py-4 pr-4 pl-5 shadow-soft-sm transition-[border-color,box-shadow] hover:border-[color-mix(in_oklab,var(--border-ink)_40%,var(--border))] hover:shadow-soft"
    >
      <span className={cn("absolute top-0 bottom-0 left-0 w-1.5", status.bar)} aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-3 pl-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <CatCell name={cat.name} />
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {ownerLabel} · {timeAgo(cat.createdAt)}
          </span>
          <span className="ml-auto font-mono text-muted-foreground text-xs">
            #{cat.id.slice(-ID_TAIL_LENGTH)}
          </span>

          <div className="flex translate-x-2 gap-2 opacity-0 transition-[opacity,transform] group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100 pointer-coarse:translate-x-0 pointer-coarse:opacity-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
            >
              <X aria-hidden />
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() =>
                void runAction(approveAllAction(cat.id), () => onResolved(cat.id), "Approve failed")
              }
            >
              <Check aria-hidden />
              Approve
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label="More actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={() =>
                    void runAction(hideCatAction(cat.id), () => onResolved(cat.id), "Hide failed")
                  }
                >
                  Hide from arena
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() =>
                    setConfirm({
                      title: `Ban "${cat.name}"?`,
                      description: "The cat is removed from duels and the leaderboard.",
                      actionLabel: "Ban cat",
                      run: () => banCatAction(cat.id),
                      onOk: () => onResolved(cat.id),
                    })
                  }
                >
                  Ban cat
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() =>
                    setConfirm({
                      title: `Delete "${cat.name}"?`,
                      description: "Permanently deletes the cat and its images.",
                      actionLabel: "Delete cat",
                      run: () => deleteCatAction(cat.id),
                      onOk: () => onResolved(cat.id),
                    })
                  }
                >
                  Delete cat
                </DropdownMenuItem>

                {showUserControls ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Owner · {ownerLabel}</DropdownMenuLabel>
                    {cat.owner.role === "MODERATOR" ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          void runAction(
                            setUserRole(cat.owner.id, "USER"),
                            () => {
                              catToast.success("Role updated");
                              onOwnerRoleChanged(cat.owner.id, "USER");
                            },
                            "Role change failed",
                          )
                        }
                      >
                        Demote to user
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() =>
                          void runAction(
                            setUserRole(cat.owner.id, "MODERATOR"),
                            () => {
                              catToast.success("Role updated");
                              onOwnerRoleChanged(cat.owner.id, "MODERATOR");
                            },
                            "Role change failed",
                          )
                        }
                      >
                        Make moderator
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        setConfirm({
                          title: `Ban ${cat.owner.email ?? "this user"}?`,
                          description: "Their cats will be deleted. This cannot be undone.",
                          actionLabel: "Ban user",
                          run: () => banUser(cat.owner.id),
                          onOk: () => onOwnerResolved(cat.owner.id),
                        })
                      }
                    >
                      Ban user
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ModerationPhotoGrid images={cat.images} catName={cat.name} />
      </div>

      <RejectReasonsDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        catName={cat.name}
        pending={busy}
        onConfirm={(reasons) =>
          void runAction(
            rejectCatImagesAction(cat.id, reasons),
            () => onResolved(cat.id),
            "Reject failed",
          )
        }
      />

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        {confirm ? (
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  const c = confirm;
                  setConfirm(null);
                  void runAction(c.run(), c.onOk, `${c.actionLabel} failed`);
                }}
              >
                {confirm.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </article>
  );
}
