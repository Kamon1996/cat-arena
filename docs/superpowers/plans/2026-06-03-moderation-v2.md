# Admin Console v2 — Slice 2: Moderation v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the flat `/admin` moderation queue with a rich, image-forward list of cat cards (per-image + per-cat actions, submitter info + admin user controls, "Load more", optimistic "highlight then remove").

**Architecture:** A Server Component page fetches page 1 via `getModerationCats()` and hands it to a client `ModerationList` (holds cats in state, "Load more" via the same server action). Each client `ModerationCard` mutates through **guarded** server-action wrappers and updates its own state optimistically (dim → badge → remove). Destructive confirms use a reusable `ConfirmButton` (shadcn AlertDialog).

**Tech Stack:** Next.js 15 (RSC + Server Actions), Prisma, shadcn (alert-dialog/card/select/badge/button), Sonner, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-moderation-v2-design.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/moderation/admin-actions.ts` | (MODIFY) add `approveCatImages(catId)` (approve-all) |
| `src/moderation/admin-actions.test.ts` | (MODIFY) add `approveCatImages` cases |
| `src/lib/constants.ts` | (MODIFY) `MODERATION_PAGE_SIZE` |
| `src/moderation/moderation-types.ts` | (NEW) `ModerationImage`/`ModerationCat`/`ModerationPage` types |
| `src/moderation/moderation-queue.ts` | (NEW, "use server") `getModerationCats(cursor?)` data action |
| `src/moderation/moderation-queue.test.ts` | (NEW) query shape + cursor/nextCursor |
| `src/moderation/moderation-actions.ts` | (NEW, "use server") guarded wrappers returning `ModResult` |
| `src/moderation/moderation-actions.test.ts` | (NEW) guard + result shape |
| `src/components/admin/confirm-button.tsx` | (NEW) reusable AlertDialog confirm |
| `src/components/admin/confirm-button.test.tsx` | (NEW) opens + confirms |
| `src/components/admin/moderation-card.tsx` | (NEW, client) one cat card, optimistic |
| `src/components/admin/moderation-list.tsx` | (NEW, client) list + Load more |
| `src/app/admin/page.tsx` | (MODIFY) render `ModerationList` + `ReportQueue` |
| `src/components/admin/moderation-queue.tsx` | (DELETE) replaced by list/card |
| `src/components/admin/user-row-actions.tsx` | (MODIFY) use `ConfirmButton` instead of `window.confirm` |

Assumed present: `requireModerator`/`requireAdmin`, `prisma`, `thumbUrl` (`@/storage/keys`),
`banUser`/`setUserRole` (`@/admin/user-actions`), `StatusBadge`, shadcn `Card`/`Badge`/`Button`/`Select`.

---

### Task 1: `approveCatImages` (approve-all)

**Files:** Modify `src/moderation/admin-actions.ts`, `src/moderation/admin-actions.test.ts`

- [ ] **Step 1: Extend the test mock + add cases in `src/moderation/admin-actions.test.ts`**

READ the file. Its hoisted `tx` mock has `catImage: { update: vi.fn() }` and `cat: { update, findUnique }`. ADD `updateMany: vi.fn()` to `tx.catImage` so it reads `catImage: { update: vi.fn(), updateMany: vi.fn() }`. Then APPEND this describe block inside the top-level `describe("admin-actions", ...)` (after the existing ones), and add `approveCatImages` to the import from `./admin-actions`:

```ts
  describe("approveCatImages", () => {
    it("approves all PENDING images and promotes a non-banned cat", async () => {
      tx.cat.findUnique.mockResolvedValueOnce({ id: CAT_ID, status: "PENDING" });
      await approveCatImages(CAT_ID);
      expect(tx.catImage.updateMany).toHaveBeenCalledWith({
        where: { catId: CAT_ID, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      expect(tx.cat.update).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        data: { status: "ACTIVE", approvedAt: expect.any(Date) },
      });
    });

    it("does NOT promote a banned cat", async () => {
      tx.cat.findUnique.mockResolvedValueOnce({ id: CAT_ID, status: "BANNED" });
      await approveCatImages(CAT_ID);
      expect(tx.catImage.updateMany).toHaveBeenCalled();
      expect(tx.cat.update).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/moderation/admin-actions.test.ts` (approveCatImages undefined).

- [ ] **Step 3: Add `approveCatImages` to `src/moderation/admin-actions.ts`** (append after `approveImage`):

```ts
/** Approve ALL pending images of a cat; promote it to ACTIVE unless BANNED. */
export async function approveCatImages(catId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.catImage.updateMany({
      where: { catId, status: "PENDING" },
      data: { status: "APPROVED" },
    });
    const cat = await tx.cat.findUnique({
      where: { id: catId },
      select: { status: true },
    });
    if (cat && cat.status !== "BANNED") {
      await tx.cat.update({
        where: { id: catId },
        data: { status: "ACTIVE", approvedAt: new Date() },
      });
    }
  });
}
```

- [ ] **Step 4: Run, expect PASS** — `npx vitest run src/moderation/admin-actions.test.ts` (all prior + 2 new).

- [ ] **Step 5: `npm run typecheck && npm run lint`; commit**

```bash
git add src/moderation/admin-actions.ts src/moderation/admin-actions.test.ts
git commit -m "feat(moderation): approveCatImages (approve-all) action"
```

---

### Task 2: Moderation queue data (`getModerationCats`)

**Files:** Modify `src/lib/constants.ts`; Create `src/moderation/moderation-types.ts`, `src/moderation/moderation-queue.ts`, `src/moderation/moderation-queue.test.ts`

- [ ] **Step 1: Append to `src/lib/constants.ts`**

```ts
// Moderation queue — cats per "Load more" page
export const MODERATION_PAGE_SIZE = 10;
```

- [ ] **Step 2: Create `src/moderation/moderation-types.ts`**

```ts
export type ModerationImage = {
  id: string;
  thumbUrl: string;
};

export type ModerationCat = {
  id: string;
  name: string;
  status: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    role: "USER" | "MODERATOR" | "ADMIN";
    banned: boolean;
  };
  images: ModerationImage[];
};

export type ModerationPage = {
  cats: ModerationCat[];
  nextCursor: string | null;
};
```

- [ ] **Step 3: Write the failing test `src/moderation/moderation-queue.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireModeratorMock, catFindMany } = vi.hoisted(() => ({
  requireModeratorMock: vi.fn(),
  catFindMany: vi.fn(),
}));

vi.mock("@/auth/guards", () => ({ requireModerator: requireModeratorMock }));
vi.mock("@/lib/r2", () => ({ publicUrl: (key: string) => `https://cdn.test/${key}` }));
vi.mock("@/lib/prisma", () => ({ prisma: { cat: { findMany: catFindMany } } }));

import { getModerationCats } from "./moderation-queue";

function makeCat(id: string) {
  return {
    id,
    name: `Cat ${id}`,
    status: "PENDING",
    owner: { id: "u1", name: null, email: "u@x.z", role: "USER", banned: false },
    images: [{ id: `${id}-img` }],
  };
}

describe("getModerationCats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireModeratorMock.mockResolvedValue({ user: { id: "m", role: "MODERATOR" } });
  });

  it("queries cats with pending images and maps thumbUrl", async () => {
    catFindMany.mockResolvedValueOnce([makeCat("a")]);
    const page = await getModerationCats();
    expect(catFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { images: { some: { status: "PENDING" } } },
        take: 11, // MODERATION_PAGE_SIZE (10) + 1
      }),
    );
    // image filter is PENDING-only
    const arg = catFindMany.mock.calls[0]?.[0] as {
      select: { images: { where: { status: string } } };
    };
    expect(arg.select.images.where).toEqual({ status: "PENDING" });
    expect(page.cats[0]?.images[0]?.thumbUrl).toBe("https://cdn.test/cats/a-img/thumb.webp");
    expect(page.nextCursor).toBeNull();
  });

  it("returns a nextCursor when there is an extra row", async () => {
    const rows = Array.from({ length: 11 }, (_, i) => makeCat(String(i)));
    catFindMany.mockResolvedValueOnce(rows);
    const page = await getModerationCats();
    expect(page.cats).toHaveLength(10);
    expect(page.nextCursor).toBe("9");
  });

  it("passes cursor + skip when a cursor is given", async () => {
    catFindMany.mockResolvedValueOnce([makeCat("z")]);
    await getModerationCats("prev-id");
    expect(catFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "prev-id" }, skip: 1 }),
    );
  });
});
```

- [ ] **Step 4: Run, expect FAIL** — `npx vitest run src/moderation/moderation-queue.test.ts`.

- [ ] **Step 5: Write `src/moderation/moderation-queue.ts`**

```ts
"use server";

import { requireModerator } from "@/auth/guards";
import { MODERATION_PAGE_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { thumbUrl } from "@/storage/keys";

import type { ModerationPage } from "@/moderation/moderation-types";

export async function getModerationCats(cursor?: string): Promise<ModerationPage> {
  await requireModerator();
  const cats = await prisma.cat.findMany({
    where: { images: { some: { status: "PENDING" } } },
    orderBy: { createdAt: "asc" },
    take: MODERATION_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      status: true,
      owner: {
        select: { id: true, name: true, email: true, role: true, banned: true },
      },
      images: {
        where: { status: "PENDING" },
        orderBy: { position: "asc" },
        select: { id: true },
      },
    },
  });

  const hasMore = cats.length > MODERATION_PAGE_SIZE;
  const page = hasMore ? cats.slice(0, MODERATION_PAGE_SIZE) : cats;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return {
    cats: page.map((cat) => ({
      id: cat.id,
      name: cat.name,
      status: cat.status,
      owner: cat.owner,
      images: cat.images.map((img) => ({ id: img.id, thumbUrl: thumbUrl(img.id) })),
    })),
    nextCursor,
  };
}
```
(If the conditional spread `...(cursor ? {...} : {})` trips the type checker inside `findMany`, build the args first: `const args = { where, orderBy, take, select }; if (cursor) { args.cursor = { id: cursor }; args.skip = 1; }` typed via `Prisma.CatFindManyArgs`.)

- [ ] **Step 6: Run, expect PASS** (3 tests). Then `npm run typecheck && npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/constants.ts src/moderation/moderation-types.ts src/moderation/moderation-queue.ts src/moderation/moderation-queue.test.ts
git commit -m "feat(moderation): getModerationCats cursor-paginated queue data"
```

---

### Task 3: Guarded action wrappers

**Files:** Create `src/moderation/moderation-actions.ts`, `src/moderation/moderation-actions.test.ts`

- [ ] **Step 1: Write the failing test `src/moderation/moderation-actions.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireModeratorMock,
  approveImage,
  rejectImage,
  approveCatImages,
  hideCat,
  banCat,
  deleteCat,
} = vi.hoisted(() => ({
  requireModeratorMock: vi.fn(),
  approveImage: vi.fn(),
  rejectImage: vi.fn(),
  approveCatImages: vi.fn(),
  hideCat: vi.fn(),
  banCat: vi.fn(),
  deleteCat: vi.fn(),
}));

vi.mock("@/auth/guards", () => ({ requireModerator: requireModeratorMock }));
vi.mock("@/moderation/admin-actions", () => ({
  approveImage,
  rejectImage,
  approveCatImages,
  hideCat,
  banCat,
  deleteCat,
}));

import {
  approveAllAction,
  approveImageAction,
  banCatAction,
  deleteCatAction,
  hideCatAction,
  rejectImageAction,
} from "./moderation-actions";

describe("moderation-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireModeratorMock.mockResolvedValue({ user: { id: "m", role: "MODERATOR" } });
  });

  it("guards then runs the action and returns ok", async () => {
    const res = await approveImageAction("img_1");
    expect(requireModeratorMock).toHaveBeenCalledOnce();
    expect(approveImage).toHaveBeenCalledWith("img_1");
    expect(res).toEqual({ ok: true });
  });

  it("maps the cat-level actions to their admin-action", async () => {
    await rejectImageAction("img_2");
    expect(rejectImage).toHaveBeenCalledWith("img_2");
    await approveAllAction("cat_1");
    expect(approveCatImages).toHaveBeenCalledWith("cat_1");
    await hideCatAction("cat_1");
    expect(hideCat).toHaveBeenCalledWith("cat_1");
    await banCatAction("cat_1");
    expect(banCat).toHaveBeenCalledWith("cat_1");
    await deleteCatAction("cat_1");
    expect(deleteCat).toHaveBeenCalledWith("cat_1");
  });

  it("returns ok:false when the mutation throws", async () => {
    approveImage.mockRejectedValueOnce(new Error("db"));
    const res = await approveImageAction("img_x");
    expect(res).toEqual({ ok: false, error: "failed" });
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/moderation/moderation-actions.test.ts`.

- [ ] **Step 3: Write `src/moderation/moderation-actions.ts`**

```ts
"use server";

import { requireModerator } from "@/auth/guards";
import {
  approveCatImages,
  approveImage,
  banCat,
  deleteCat,
  hideCat,
  rejectImage,
} from "@/moderation/admin-actions";

export type ModResult = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<void>): Promise<ModResult> {
  await requireModerator();
  try {
    await fn();
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function approveImageAction(imageId: string): Promise<ModResult> {
  return run(() => approveImage(imageId));
}

export async function rejectImageAction(imageId: string): Promise<ModResult> {
  return run(() => rejectImage(imageId));
}

export async function approveAllAction(catId: string): Promise<ModResult> {
  return run(() => approveCatImages(catId));
}

export async function hideCatAction(catId: string): Promise<ModResult> {
  return run(() => hideCat(catId));
}

export async function banCatAction(catId: string): Promise<ModResult> {
  return run(() => banCat(catId));
}

export async function deleteCatAction(catId: string): Promise<ModResult> {
  return run(() => deleteCat(catId));
}
```

- [ ] **Step 4: Run, expect PASS** (3 tests). Then `npm run typecheck && npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/moderation/moderation-actions.ts src/moderation/moderation-actions.test.ts
git commit -m "feat(moderation): requireModerator-guarded action wrappers for the client queue"
```

---

### Task 4: Reusable ConfirmButton (AlertDialog)

**Files:** Create `src/components/admin/confirm-button.tsx`, `src/components/admin/confirm-button.test.tsx`

- [ ] **Step 1: Install shadcn alert-dialog**

Run: `npx shadcn@latest add alert-dialog --yes`
Expected: `src/components/ui/alert-dialog.tsx` created (new — no overwrite). If it prompts to overwrite an existing file, answer No / report.

- [ ] **Step 2: Write the failing test `src/components/admin/confirm-button.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmButton } from "./confirm-button";

describe("ConfirmButton", () => {
  it("opens a dialog and calls onConfirm when confirmed", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmButton
        label="Ban"
        title="Ban this user?"
        description="Cats deleted."
        confirmLabel="Ban user"
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ban" }));
    expect(screen.getByText("Ban this user?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ban user" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run, expect FAIL** — `npx vitest run src/components/admin/confirm-button.test.tsx`.

- [ ] **Step 4: Write `src/components/admin/confirm-button.tsx`**

```tsx
"use client";

import type { ComponentProps, ReactNode } from "react";

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

type ConfirmButtonProps = {
  label: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  disabled?: boolean;
};

export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  variant = "destructive",
  size = "sm",
  disabled,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={variant} size={size} disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 5: Run, expect PASS** (1 test). Then `npm run typecheck && npm run lint` (format if needed).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/confirm-button.tsx src/components/admin/confirm-button.test.tsx src/components/ui/alert-dialog.tsx package.json package-lock.json
git commit -m "feat(ui): reusable ConfirmButton (shadcn AlertDialog)"
```

---

### Task 5: Moderation card + list (client)

**Files:** Create `src/components/admin/moderation-card.tsx`, `src/components/admin/moderation-list.tsx`

- [ ] **Step 1: Write `src/components/admin/moderation-card.tsx`** EXACTLY:

```tsx
"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { banUser, setUserRole } from "@/admin/user-actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
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
};

const RESOLVE_DELAY_MS = 1200;

type ActionResult = { ok: boolean; error?: string };

export function ModerationCard({
  cat,
  isAdmin,
  currentUserId,
  onResolved,
}: ModerationCardProps) {
  const [images, setImages] = useState(cat.images);
  const [busy, setBusy] = useState(false);
  const [doneLabel, setDoneLabel] = useState<string | null>(null);

  function markDone(label: string): void {
    setDoneLabel(label);
    setTimeout(() => onResolved(cat.id), RESOLVE_DELAY_MS);
  }

  async function run(
    action: Promise<ActionResult>,
    onOk: () => void,
    errPrefix: string,
  ): Promise<void> {
    setBusy(true);
    const res = await action;
    setBusy(false);
    if (res.ok) {
      onOk();
    } else {
      toast.error(`${errPrefix} (${res.error ?? "failed"})`);
    }
  }

  function resolveImage(imageId: string, doneWord: string): void {
    const next = images.filter((i) => i.id !== imageId);
    setImages(next);
    if (next.length === 0) {
      markDone(doneWord);
    }
  }

  const showUserControls =
    isAdmin && cat.owner.role !== "ADMIN" && cat.owner.id !== currentUserId;

  return (
    <Card
      className={
        doneLabel ? "pointer-events-none opacity-50 transition-opacity" : undefined
      }
    >
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
                    () => toast.success("Role updated"),
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
                    () => markDone("user banned"),
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
                <img
                  src={image.thumbUrl}
                  alt={cat.name}
                  className="h-full w-full object-cover"
                />
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
            void run(
              approveAllAction(cat.id),
              () => markDone("approved"),
              "Approve-all failed",
            )
          }
        >
          Approve all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(hideCatAction(cat.id), () => markDone("hidden"), "Hide failed")
          }
        >
          Hide
        </Button>
        <ConfirmButton
          label="Ban cat"
          title={`Ban "${cat.name}"?`}
          description="The cat is removed from duels and the leaderboard."
          confirmLabel="Ban cat"
          disabled={busy}
          onConfirm={() =>
            void run(banCatAction(cat.id), () => markDone("banned"), "Ban failed")
          }
        />
        <ConfirmButton
          label="Delete cat"
          title={`Delete "${cat.name}"?`}
          description="Permanently deletes the cat and its images."
          confirmLabel="Delete cat"
          disabled={busy}
          onConfirm={() =>
            void run(
              deleteCatAction(cat.id),
              () => markDone("deleted"),
              "Delete failed",
            )
          }
        />
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 2: Write `src/components/admin/moderation-list.tsx`** EXACTLY:

```tsx
"use client";

import { useState } from "react";

import { ModerationCard } from "@/components/admin/moderation-card";
import { Button } from "@/components/ui/button";
import { getModerationCats } from "@/moderation/moderation-queue";

import type {
  ModerationCat,
  ModerationPage,
} from "@/moderation/moderation-types";

type ModerationListProps = {
  initial: ModerationPage;
  isAdmin: boolean;
  currentUserId: string;
};

export function ModerationList({
  initial,
  isAdmin,
  currentUserId,
}: ModerationListProps) {
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
```

- [ ] **Step 3: `npm run typecheck && npm run lint`** (format if needed). typecheck exit 0; lint only the pre-existing `cat-image-carousel.tsx` warning (the card `<img>` is biome-ignored).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/moderation-card.tsx src/components/admin/moderation-list.tsx
git commit -m "feat(moderation): client moderation card + list (optimistic, load more)"
```

---

### Task 6: Wire `/admin` + remove old queue + retrofit confirm

**Files:** Modify `src/app/admin/page.tsx`; Delete `src/components/admin/moderation-queue.tsx`; Modify `src/components/admin/user-row-actions.tsx`

- [ ] **Step 1: Replace `src/app/admin/page.tsx`** with:

```tsx
import { requireModerator } from "@/auth/guards";
import { ModerationList } from "@/components/admin/moderation-list";
import { ReportQueue } from "@/components/admin/report-queue";
import { getModerationCats } from "@/moderation/moderation-queue";

export default async function AdminPage() {
  const session = await requireModerator();
  const first = await getModerationCats();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="font-bold text-2xl tracking-tight">Moderation</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        Review pending cat images.
      </p>
      <ModerationList
        initial={first}
        isAdmin={session.user.role === "ADMIN"}
        currentUserId={session.user.id}
      />
      <div className="mt-10">
        <ReportQueue />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete the old queue component**

Run: `git rm src/components/admin/moderation-queue.tsx`
(Confirm nothing else imports it: `grep -rn "moderation-queue\"" src` should return nothing — the page no longer imports `ModerationQueue`.)

- [ ] **Step 3: Retrofit `src/components/admin/user-row-actions.tsx` to use `ConfirmButton`**

READ the file. Replace the `window.confirm`-based ban flow: the Ban button (when `!user.banned`) becomes a `ConfirmButton`; Unban stays a plain `Button` (no confirm). Concretely:
- Add `import { ConfirmButton } from "@/components/admin/confirm-button";`.
- Remove the `window.confirm(...)` guard from `onBanToggle`; split into `doBan()` (calls `banUser`) and keep `unban` inline.
- In the JSX, render: when `user.banned` → a plain `<Button variant="outline" size="sm" onClick={unban}>Unban</Button>`; else → `<ConfirmButton label="Ban" title={\`Ban ${user.email ?? "this user"}?\`} description="Their cats will be deleted. This cannot be undone." confirmLabel="Ban user" disabled={busy} onConfirm={() => void doBan()} />`.
Keep the role `Select` unchanged. Keep toast + `router.refresh()` behavior. Ensure no `window.confirm` remains (`grep -n window.confirm src/components/admin/user-row-actions.tsx` → empty).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck 0; lint only the pre-existing warning; all tests pass (131 prior + new: approveCatImages (2), moderation-queue (3), moderation-actions (3), confirm-button (1) = 140).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/components/admin/user-row-actions.tsx
git commit -m "feat(moderation): wire ModerationList into /admin; AlertDialog confirm for user ban; drop old queue"
```

---

### Task 7: Full-slice verification

**Files:** none (throwaway preview route, removed before finishing)

- [ ] **Step 1: Whole suite** — `npm test` → all green (~140 tests).
- [ ] **Step 2: Checks** — `npm run typecheck && npm run lint && npm run lint:css` → typecheck 0; Biome only the pre-existing `cat-image-carousel.tsx` warning; Stylelint clean.
- [ ] **Step 3: Dev smoke screenshot** — create a throwaway `src/app/style-preview/page.tsx` that renders `<SidebarProvider><AdminSidebar isAdmin/><SidebarInset>` wrapping a `<ModerationList initial={MOCK_PAGE} isAdmin currentUserId="x" />` with 2 mock `ModerationCat`s (one with 2 images, one owned by a normal USER so the Ban-user/role controls show; thumbUrls → `https://placecats.com/300/300`). `npm run dev`, screenshot `/style-preview`, confirm cards render with images + actions + submitter controls + "Load more" hidden (single page), then DELETE the preview, clear `.next`, stop the server.
- [ ] **Step 4: Confirm clean tree** — `git status --short` shows nothing untracked except `.claude/settings.json`.
