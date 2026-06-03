# Admin Console v2 — Slice 1: Shell + Users (Design Spec)

> First of two slices of Admin Console v2. Builds the admin **sidebar shell**, the
> **user-management** page (roles, banning) on a **reusable DataTable**, the schema
> + auth wiring for **email-blacklist banning**, and the admin actions. Slice 2
> (Moderation v2) reuses this shell + actions and is **out of scope here**.

**Status:** approved 2026-06-03. Requires a Prisma migration.
**Styling:** use the existing shadcn/Tailwind kit — pages ship presentable (see memory `ui-styling-deferred`).

## Goals

- An admin sidebar shell wraps `/admin/*` (Moderation + Users nav; Users visible to admins only).
- Admins manage users in a paginated table: change role (USER↔MODERATOR), ban/unban.
- **Banning** a user: blacklist their email (persistent), delete all their cats (free DB + R2),
  force-logout, and block all further actions and any future sign-in with that email.
- A **reusable `DataTable`** (TanStack Table + shadcn Table) usable elsewhere later.

## Non-goals (Slice 2 or other)

- Rich moderation UX (submitter name, approve-all, per-image, done-state highlight, infinite scroll).
- Granting/revoking ADMIN via UI (ADMIN is set manually in the DB).
- `/cat/[slug]`, `/top` (phase 08).

## Architecture decision

**RSC + Server Actions + server-side pagination** (chosen over a TanStack-Query client approach).
Admin pages are Server Components that read via Prisma using a `?page=` param. Mutations
(ban/unban/setRole) are `requireAdmin` Server Actions returning a typed `{ ok }` result; client
row-action components call them and toast. The `DataTable` is a client component in TanStack
Table's **manual pagination** mode (it renders server-fetched rows; the page controls are links).
Rationale: matches the codebase (`/admin`, cabinet) and avoids new API endpoints.

## Data model (Prisma migration)

```prisma
model User {
  // ...existing fields...
  banned   Boolean   @default(false)
  bannedAt DateTime?
}

model BannedEmail {
  id          String   @id @default(cuid())
  email       String   @unique
  reason      String?
  bannedById  String?  // admin who banned (no FK needed; informational)
  createdAt   DateTime @default(now())
}
```

`BannedEmail` is the durable source of truth for login blocking (survives user deletion).
`User.banned` is a fast per-session flag for guard checks. Migration name: `admin_user_ban`.

## Auth integration (`src/auth/config.ts`, guards, types)

- **`signIn` callback:** reject sign-in when the email is in `BannedEmail`
  (`prisma.bannedEmail.findUnique({ where: { email } })` → return `false`). Blocks both
  re-login and fresh sign-ups with a blacklisted email.
- **`session` callback:** include `banned` on `session.user` (read from the adapter user).
- **Types:** extend the next-auth `Session["user"]` augmentation with `banned: boolean`.
- **`requireUser` (`src/auth/guards.ts`):** if `session.user.banned`, sign out and redirect to
  `/signin?banned=1`. `/signin` shows an "account is banned" notice when `banned=1`.
  (`requireModerator`/`requireAdmin` build on `requireUser`, so they inherit the block.)

## Admin user actions (`src/admin/user-actions.ts`, all `requireAdmin`)

Return `OwnerActionResult`-style `{ ok: true } | { ok: false; error: string }`.

- **`banUser(userId)`** — in order:
  1. Load the target user (`id`, `email`, `role`). Refuse if `role === "ADMIN"` (`error: "admin"`)
     or `userId === session.user.id` (`error: "self"`).
  2. Collect all image ids of all the user's cats → `deleteObjects` (best-effort R2 cleanup).
  3. `prisma.cat.deleteMany({ where: { ownerId: userId } })` (cascades `CatImage`/`CatOrg` rows).
  4. Upsert `BannedEmail` (by email) if the user has an email.
  5. Delete the user's `Session` rows (force logout).
  6. `prisma.user.update` → `banned: true, bannedAt: new Date()`.
  7. `revalidatePath("/admin/users")`.
- **`unbanUser(userId)`** — delete the `BannedEmail` row (by the user's email) and set
  `banned: false, bannedAt: null`. Cats are NOT restored. `requireAdmin`.
- **`setUserRole(userId, role)`** — `role` validated to `USER | MODERATOR` (Zod enum). Refuse if
  the target is `ADMIN` (`error: "admin"`) or `userId === session.user.id` (`error: "self"`).
  Update `user.role`. `revalidatePath("/admin/users")`.
- Unit tests (mock prisma/r2/auth): ban deletes cats + cleans R2 + blacklists email + drops
  sessions + flags user; refuses ADMIN/self; unban clears blacklist+flag; setRole validates +
  protects ADMIN/self.

## Reusable DataTable (`src/components/ui/data-table.tsx`)

- Install `@tanstack/react-table`; add shadcn `table`.
- Generic client component `DataTable<TData, TValue>({ columns, data, pageIndex, pageCount, basePath })`:
  uses `useReactTable` with `manualPagination: true`, renders the shadcn `Table`, and Prev/Next
  controls as `<Link>`s to `?page=`. Empty state row when `data` is empty.

## Admin shell (`src/app/admin/layout.tsx`)

- shadcn **Sidebar** (install `sidebar` + its deps). `requireModerator()` gates the whole `/admin`
  subtree. Sidebar nav: **Moderation** → `/admin`, **Users** → `/admin/users` (rendered only when
  `session.user.role === "ADMIN"`). Active item highlighted via the current path. The existing
  `/admin/page.tsx` (moderation) now renders inside this shell (its own `requireModerator` stays;
  harmless redundancy). Slice 2 rebuilds the moderation content.

## Users page (`src/app/admin/users/page.tsx`, `requireAdmin`)

- `searchParams.page` (default 1, clamp ≥1); page size constant (e.g. `ADMIN_USERS_PAGE_SIZE = 20`).
- Query: `prisma.user.findMany({ orderBy: { ... }, skip, take, select: { id, name, email, role,
  banned, createdAt, _count: { select: { cats: true } } } })` + `prisma.user.count()` → `pageCount`.
- Render the `DataTable` with columns: **Email/name · Role (StatusBadge-like) · Cats (#) · Status
  (Active/Banned) · Joined · Actions**. Actions (`src/components/admin/user-row-actions.tsx`,
  client): role `<Select>` (USER/MODERATOR, hidden for ADMIN) calling `setUserRole`; **Ban/Unban**
  button (confirm; hidden for ADMIN rows and the current admin) calling `banUser`/`unbanUser`;
  toast + `router.refresh()`.

## Edge cases

- Cannot ban or role-change ADMIN users or yourself (enforced server-side AND hidden in UI).
- Banning is idempotent (`BannedEmail` upsert; deleting already-deleted cats is a no-op).
- A user with no email (shouldn't happen with magic-link) → skip blacklist insert, still ban.
- R2 cleanup is best-effort and must not block the ban's DB success.

## Testing

- Vitest unit tests for `user-actions` (above) and the `signIn`-blacklist branch (mock prisma).
- `DataTable`/pages: typecheck + lint + a dev smoke screenshot via a throwaway preview route
  (admin pages are gated). Full suite stays green.

## Reused / touched existing code

- `requireAdmin`/`requireModerator`/`requireUser` (`src/auth/guards.ts`), `auth` config
  (`src/auth/config.ts`), next-auth types augmentation, `prisma`, `deleteObjects` (`@/lib/r2`),
  `@/storage/keys`, `StatusBadge` (`@/components/dashboard/status-badge`), shadcn `Button`/`Badge`/
  `Select`/`Table`/`Sidebar`. New constants in `src/lib/constants.ts` (`ADMIN_USERS_PAGE_SIZE`).
