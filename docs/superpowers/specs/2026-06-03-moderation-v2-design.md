# Admin Console v2 — Slice 2: Moderation v2 (Design Spec)

> Rebuilds the `/admin` moderation queue as a rich, image-forward list of cat cards
> with per-image + per-cat actions, submitter info + admin user controls, "Load more"
> pagination, and an optimistic "highlight then remove" done-state. Reuses the Slice-1
> admin shell, `banUser`/`setUserRole`, and existing `admin-actions`.

**Status:** approved 2026-06-03. No DB migration.
**Styling:** existing shadcn/Tailwind kit (see memory `ui-styling-deferred`).

## Goals

- `/admin` moderation shows cats that need review (≥1 `PENDING` image) as large cards.
- Each card: cat name + status, **submitter** (name/email; ADMIN sees Ban + role Select),
  the cat's PENDING images each with **Approve/Reject**, **Approve all**, and
  Hide / Ban cat / Delete cat.
- **"Load more"** appends the next page (cursor pagination).
- Optimistic **done-state**: after a cat's images are all resolved (or the cat/owner is
  actioned), the card dims + shows a badge, then is removed from the list.

## Non-goals

- Infinite auto-scroll (chosen: explicit "Load more"). Moving `ReportQueue` to its own
  sidebar item (stays on `/admin` below moderation). Moderation analytics.

## Architecture decision

**Server-fetched first page → client list with "Load more" via a server action.** The
`/admin` page (Server Component) fetches page 1 and passes it to a client `ModerationList`
that holds the accumulated cats in state, fetches more via the `getModerationCats(cursor)`
server action, and renders client `ModerationCard`s. Cards mutate via **guarded** server
actions and update their own state optimistically (dim → badge → remove). No TanStack Query
needed; no new REST endpoint (server actions return serializable data).

## Security: guarded action wrappers (important)

The existing `src/moderation/admin-actions.ts` functions (`approveImage`, `rejectImage`,
`hideCat`, `banCat`, `deleteCat`) have **no auth guard** — the old inline server actions
added `requireModerator` around them. The new client cards call actions directly, so we add
**guarded wrappers** in `src/moderation/moderation-actions.ts` (each `requireModerator` then
the mutation, returning `ModResult`). `banUser`/`setUserRole` (Slice 1) already `requireAdmin`
and are called directly for submitter controls (admin-only in UI + server).

## Data: `src/moderation/moderation-queue.ts`

- `MODERATION_PAGE_SIZE = 10` (in `src/lib/constants.ts`).
- Types (serializable): `ModerationImage { id, thumbUrl }`; `ModerationCat { id, name, status,
  owner { id, name|null, email|null, role, banned }, images: ModerationImage[] }`;
  `ModerationPage { cats: ModerationCat[]; nextCursor: string | null }`.
- `getModerationCats(cursor?)` — `"use server"`, `requireModerator()`; query:
  `prisma.cat.findMany({ where: { images: { some: { status: "PENDING" } } },
   orderBy: { createdAt: "asc" }, take: PAGE_SIZE + 1, (cursor ? cursor:{id}, skip:1),
   select: { id, name, status, owner: {id,name,email,role,banned},
   images: { where: { status: "PENDING" }, orderBy:{position:"asc"}, select:{id} } } })`.
  Compute `hasMore = len > PAGE_SIZE`; slice to PAGE_SIZE; `nextCursor = last.id | null`;
  map images to `{ id, thumbUrl: thumbUrl(id) }`. (If the conditional cursor spread trips
  the type checker, build the args object and assign `cursor`/`skip` when `cursor` is set.)

## Actions

- **`src/moderation/admin-actions.ts`** (MODIFY): add `approveCatImages(catId)` — in one
  `$transaction`: `catImage.updateMany({ where:{catId,status:"PENDING"}, data:{status:"APPROVED"} })`,
  then promote the cat to `ACTIVE` + `approvedAt` unless it is `BANNED`. (Pure, no guard — like
  the siblings.)
- **`src/moderation/moderation-actions.ts`** (NEW, `"use server"`): `ModResult = {ok:true} |
  {ok:false, error:string}`; a private `run(fn)` = `await requireModerator()` then
  `try { await fn(); return {ok:true} } catch { return {ok:false, error:"failed"} }` (try/catch
  wraps ONLY the mutation, so a `requireModerator` redirect still propagates). Exported async
  wrappers: `approveImageAction(imageId)`, `rejectImageAction(imageId)`, `approveAllAction(catId)`,
  `hideCatAction(catId)`, `banCatAction(catId)`, `deleteCatAction(catId)` — each `run(() => …)`.

## Components

- `src/app/admin/page.tsx` (MODIFY): `requireModerator()`; read `session.user.role`/`id`;
  `const first = await getModerationCats()`; render heading + `<ModerationList initial={first}
  isAdmin={...} currentUserId={...} />` then the existing `<ReportQueue />` below.
- `src/components/admin/moderation-list.tsx` (NEW, client): props `{ initial: ModerationPage,
  isAdmin, currentUserId }`; state `cats` (init `initial.cats`) + `cursor` (init
  `initial.nextCursor`) + `loading`. Renders a grid/stack of `ModerationCard`s; "Load more"
  button (shown when `cursor`) calls `getModerationCats(cursor)` and appends. `onResolved(catId)`
  removes the cat from `cats`. Empty state when `cats` is empty.
- `src/components/admin/moderation-card.tsx` (NEW, client): props `{ cat, isAdmin,
  currentUserId, onResolved }`; local `images` state (cat's PENDING images) + `done` flag.
  Layout: cat name + `StatusBadge`; submitter row (name/email; if `isAdmin` and owner not
  admin/self → role `Select` USER/MODERATOR via `setUserRole`, **Ban user** via `banUser`);
  image grid (each thumb + Approve/Reject); **Approve all**; Hide / Ban cat / Delete cat.
  Behavior: image action → on ok remove that image from local state; when empty → `markDone`.
  Approve-all / hide / ban cat / delete cat / ban user → `markDone`. `markDone(label)` sets
  `done` (dim + a badge like "approved"/"removed"/"banned") then `setTimeout(() =>
  onResolved(cat.id), 1200)`. Errors → `toast.error`.
- Destructive confirms (Ban user, Ban cat, Delete cat) use shadcn **AlertDialog** (install it).
  **Also retrofit** `src/components/admin/user-row-actions.tsx` to use AlertDialog instead of
  `window.confirm` (closes the Slice-1 follow-up).

## Edge cases / rules

- Submitter controls (ban/role) render only when `isAdmin && owner.role !== "ADMIN" &&
  owner.id !== currentUserId` (mirrors server `requireAdmin` + self/admin guards).
- A cat with all images resolved no longer matches the query, so a fresh load won't show it;
  the optimistic removal keeps the visible list in sync without a full refetch.
- "Load more" dedupes by cat id when appending (defensive against overlap).
- Banning the submitter deletes their cats (Slice 1) — the card resolves immediately.

## Testing (Vitest)

- `approveCatImages` (mock prisma `$transaction`): updateMany PENDING→APPROVED + promote
  ACTIVE; banned cat not promoted.
- `getModerationCats` (mock `requireModerator` + `prisma.cat.findMany` + `@/lib/r2`): query
  shape (where images.some PENDING, take PAGE_SIZE+1, image filter PENDING, cursor when given);
  `nextCursor` set when `hasMore`, null otherwise; thumbUrl mapping.
- `moderation-actions` (mock `requireModerator` + admin-actions): wrappers call the guard then
  the action and return `{ok:true}`; `{ok:false}` when the mutation throws.
- List/card: typecheck + lint + a dev smoke screenshot via a throwaway preview route.

## Reused / touched

- Slice-1 admin shell/layout, `banUser`/`setUserRole` (`src/admin/user-actions.ts`),
  `StatusBadge`, shadcn `Badge`/`Button`/`Select`/`AlertDialog`, `requireModerator`/`requireAdmin`,
  `thumbUrl` (`@/storage/keys`), `admin-actions`. Removes the old `src/components/admin/
  moderation-queue.tsx` (replaced by list/card); `ReportQueue` unchanged.
