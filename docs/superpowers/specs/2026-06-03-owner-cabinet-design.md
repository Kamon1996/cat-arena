# Owner Cabinet — Design Spec

> Sub-project of cat-arena. Lets an authenticated owner manage their own cats:
> view, rename, manage images (add / delete / replace), and delete the cat.
> **Functionality-first prototype** — visual styling is intentionally minimal and
> deferred to a later app-wide redesign (design system + tokens). Build it
> functional, accessible, and bug-free.

**Status:** approved 2026-06-03. No DB migration required (all fields already exist).

## Goals

- A signed-in user can see all cats they own, with each cat's status and images.
- Rename a cat (display name only).
- Manage a cat's images: add (up to `MAX_IMAGES_PER_CAT`), delete (never the last one),
  "replace" (= delete + add).
- Delete a cat entirely (with R2 object cleanup).
- Every mutation is owner-scoped and safe; no way to touch another user's cat.

## Non-goals (out of scope / other sub-projects)

- Any admin/moderator capability, role changes, user banning, users table.
- Reusable DataTable / TanStack Table (that's Admin Console v2).
- Leaderboard `/top`, cat detail `/cat/[slug]` (phase 08).
- **Visual polish.** UI is functional + accessible only; the design-system/token
  redesign is a separate later pass (see memory `ui-styling-deferred`). Do not invest
  in Tailwind/shadcn styling here beyond what's needed to be usable.

## Architecture decision

**RSC page + Server Actions** (chosen over a TanStack-Query client approach).
- The `/dashboard` page is a Server Component that reads the owner's cats directly via
  Prisma. Mutations (rename, delete cat, delete image) are inline **Server Actions** that
  `revalidatePath('/dashboard')`. A small client island reuses `ImageDropzone` for adding
  a photo (browser presign → PUT to R2 → server action to attach).
- Rationale: matches the existing `/admin` (server actions) and `/upload` (client presign)
  patterns; less client JS; consistent with the codebase. TanStack Query is reserved for
  the duel's polling needs, not needed here.

## Routes & IA

- **`/dashboard`** — "My cats". Server Component gated by `requireUser()` (redirects to
  `/signin`). Renders a grid of owned-cat cards. Empty state links to `/upload`.
- `SiteHeader`: when a session exists, add a **"My cats" → /dashboard** link.
- **Cat card** shows: display name (inline rename), status badge
  (PENDING/ACTIVE/HIDDEN/BANNED), the cat's images (thumb) each with its `ImageStatus`,
  and controls: rename, add image, delete image (per image), delete cat.
- **"Add a cat" → /upload**, disabled/hidden when the user is at `MAX_CATS_PER_USER` (2).

## Data model

No schema change. Uses existing `Cat` (`name`, `slug`, `ownerId`, `status`, `approvedAt`)
and `CatImage` (`id`, `catId`, `r2Key`, `width`, `height`, `position`, `status`).
`CatImage` already has `onDelete: Cascade` from `Cat`, so deleting a cat removes its image
rows; R2 objects are deleted explicitly (no DB cascade to object storage).

## Backend modules (new)

All mutations verify ownership: the target cat's `ownerId === session.user.id`, else 404/403.

- **`src/cats/owner-guard.ts`** (new — keeps `src/auth/guards.ts` focused on session/role):
  `requireOwnedCat(catId): Promise<{ session, cat }>` — `requireUser()` then load the cat;
  return a typed "not found / not yours" result (404/403) otherwise. Used by every owner action.
- **`src/cats/owner-actions.ts`** — Server Actions (`"use server"`), each owner-guarded:
  - `renameCat(catId, name)` — Zod-validate name (1..60, trimmed); update **`name` only**
    (slug unchanged); `revalidatePath('/dashboard')`. Blocked when cat is `BANNED`.
  - `deleteCatImage(imageId)` — owner-guard via the image's cat; **refuse if it's the last
    remaining image** (return a typed error → toast); delete the row; delete its R2 objects
    (original/thumb/card). Blocked when cat is `BANNED`.
  - `addCatImage(catId, r2Key)` — owner-guard; enforce `images.length < MAX_IMAGES_PER_CAT`;
    validate `r2Key` shape (`cats/<id>/original`); run the shared ingest (process + screen);
    create the `CatImage` at `position = max(existing)+1`, status from the screen. New image
    is `PENDING` until a moderator approves; an `ACTIVE` cat stays `ACTIVE`. Blocked when
    cat is `BANNED`.
  - `deleteCatOwned(catId)` — owner-guard; delete the cat (cascade removes `CatImage` rows);
    delete **all** of the cat's R2 objects. Blocked when cat is `BANNED`.
- **`src/storage/ingest-image.ts`** (refactor, DRY) — extract the per-image
  "`processImage` → `screenImage` → CatImage create-data" logic currently inline in
  `POST /api/cats`, and reuse it from both `/api/cats` and `addCatImage`.
- **`src/lib/r2.ts`** (extend) — `deleteObjects(keys: string[]): Promise<void>` using
  `DeleteObjectCommand` (or per-key `DeleteObjectCommand`), for image/cat cleanup.

## Components (new, functional/minimal)

- `src/app/dashboard/page.tsx` — RSC; `await requireUser()`; query owned cats (+images);
  render the grid; pass server actions down.
- `src/components/dashboard/cat-card.tsx` — one cat: status badge, image strip, controls.
  Server component where possible; small client bits for the inline rename input and the
  add-image flow.
- `src/components/dashboard/rename-cat-form.tsx` — client; inline name edit → `renameCat`.
- `src/components/dashboard/add-image.tsx` — client; reuse `ImageDropzone`; presign → PUT →
  `addCatImage`. Disabled at the 3-image cap.
- Delete buttons are `<form action={serverAction}>` with confirmation for cat deletion.

## Flows

- **Rename:** inline input → `renameCat` → revalidate. Slug unchanged.
- **Add image:** pick file (reuse dropzone) → `POST /api/upload/sign` → `PUT` original to R2
  → `addCatImage(catId, r2Key)` → new image `PENDING` (enters the mod queue) → revalidate.
- **Replace:** UI composition of delete + add (no separate endpoint/logic).
- **Delete image:** `deleteCatImage` (refused if last) → R2 cleanup → revalidate.
- **Delete cat:** confirm → `deleteCatOwned` → cascade + R2 cleanup → revalidate.

## Editing rules by cat status

- `PENDING` / `ACTIVE` / `HIDDEN`: fully editable. (Editing a `HIDDEN` cat adds fresh
  `PENDING` images for re-moderation; un-hiding remains a moderator action.)
- `BANNED`: **locked** — view + delete only; rename/add/delete-image refused.

## Edge cases

- Cannot delete the last image of a cat (must add another first, or delete the whole cat).
- `MAX_CATS_PER_USER` (2) and `MAX_IMAGES_PER_CAT` (3) enforced server-side (UI also reflects).
- Deleting a cat leaves historical `Vote` rows (no FK on `Vote.winnerCatId/loserCatId`) — acceptable.
- R2 cleanup is best-effort and must not block the DB mutation's success path; log/ignore
  R2 delete failures (object orphaning is acceptable vs. a failed user action).

## Testing (Vitest; mock prisma / r2 / screen)

- Ownership: each action 403/404 for a non-owner / missing cat.
- `addCatImage`: refuses at 3-image cap; new image is `PENDING`; ingest called.
- `deleteCatImage`: refuses deleting the last image; calls `deleteObjects`.
- `renameCat`: updates `name`, leaves `slug` unchanged; rejects bad name.
- `deleteCatOwned`: deletes cat + calls `deleteObjects` for all image keys.
- `BANNED` cat: all mutations refused.
- `ingest-image` refactor: `/api/cats` route tests still pass unchanged.

## Reused / touched existing code

- `requireUser` (`src/auth/guards.ts`), `prisma`, `@/lib/r2` (`presignPut`, `publicUrl`,
  new `deleteObjects`), `@/storage/keys`, `processImage`, `screenImage`, `ImageDropzone`,
  `MAX_CATS_PER_USER`, `MAX_IMAGES_PER_CAT`. `POST /api/cats` refactored to use the new
  `ingest-image` helper (behavior unchanged; existing tests must stay green).
