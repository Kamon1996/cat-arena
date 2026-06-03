# Admin Console v2 — Slice 1: Shell + Users — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Admin sidebar shell + user management (role USER↔MODERATOR, email-blacklist ban that deletes the user's cats) on a reusable TanStack `DataTable`.

**Architecture:** RSC pages under `/admin/*` gated by `requireModerator` (Users page `requireAdmin`), server-side `?page=` pagination, `requireAdmin` Server Actions for ban/unban/role returning `{ ok }`, client row-actions that toast + `router.refresh()`. Banning blacklists the email (persistent `BannedEmail`), deletes the user's cats (+ R2 cleanup), force-logs-out, and is enforced at `signIn` + `requireUser`.

**Tech Stack:** Next.js 15 App Router, Prisma + Neon, Auth.js v5, `@tanstack/react-table`, shadcn (sidebar/table/select/badge/button), Zod, Sonner, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-admin-shell-users-design.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | (MODIFY) `User.banned`/`bannedAt`; new `BannedEmail` model |
| `src/auth/is-email-banned.ts` | (NEW) `isEmailBanned(email)` — blacklist lookup |
| `src/auth/is-email-banned.test.ts` | (NEW) unit test |
| `src/auth/config.ts` | (MODIFY) `signIn` blacklist callback + `session.user.banned` |
| `types/next-auth.d.ts` | (MODIFY) add `banned` to Session user + User |
| `src/auth/guards.ts` | (MODIFY) `requireUser` redirects banned → `/signin?banned=1` |
| `src/app/signin/page.tsx` | (MODIFY) show a notice when `?banned=1` |
| `src/lib/constants.ts` | (MODIFY) `ADMIN_USERS_PAGE_SIZE` |
| `src/admin/user-actions.ts` | (NEW) `banUser`/`unbanUser`/`setUserRole` server actions |
| `src/admin/user-actions.test.ts` | (NEW) unit tests |
| `src/components/ui/data-table.tsx` | (NEW) reusable TanStack DataTable (manual pagination) |
| `src/components/ui/data-table.test.tsx` | (NEW) render test |
| `src/components/admin/admin-sidebar.tsx` | (NEW) client sidebar (nav + active state) |
| `src/app/admin/layout.tsx` | (NEW) admin shell (SidebarProvider + inset) |
| `src/components/admin/user-row-actions.tsx` | (NEW) client role Select + Ban/Unban |
| `src/components/admin/users-table.tsx` | (NEW) client: column defs + DataTable |
| `src/app/admin/users/page.tsx` | (NEW) server: paginated users query → UsersTable |

Assumed present: `requireUser`/`requireModerator`/`requireAdmin` (`src/auth/guards.ts`), `prisma`, `deleteObjects` (`@/lib/r2`), `@/storage/keys` (`originalKey`/`thumbKey`/`cardKey`), `Button`/`Badge`/`StatusBadge`, Sonner `toast`.

---

### Task 1: Schema migration — user ban + BannedEmail

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add fields to `User`**

In the `User` model, add these two fields (after `role`):
```prisma
  banned        Boolean       @default(false)
  bannedAt      DateTime?
```

- [ ] **Step 2: Add the `BannedEmail` model** (place it after the `User` model)

```prisma
model BannedEmail {
  id         String   @id @default(cuid())
  email      String   @unique
  reason     String?
  bannedById String? // admin who banned (informational, no FK)
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 3: Create + apply the migration**

Run: `npm run db:migrate -- --name admin_user_ban`
Expected: migration created under `prisma/migrations/`, applied to the dev DB, and `prisma generate` runs. (`db:migrate` = `dotenv -e .env.local -- prisma migrate dev`.)
If the DB is unreachable, STOP and report BLOCKED with the exact error.

- [ ] **Step 4: Typecheck (regenerated client picks up new fields)**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): user ban fields + BannedEmail model (migration admin_user_ban)"
```

---

### Task 2: Auth — email blacklist + banned session + guard

**Files:** Create `src/auth/is-email-banned.ts`, `src/auth/is-email-banned.test.ts`; Modify `src/auth/config.ts`, `types/next-auth.d.ts`, `src/auth/guards.ts`, `src/app/signin/page.tsx`

- [ ] **Step 1: Write the failing test `src/auth/is-email-banned.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { bannedEmail: { findUnique } },
}));

import { isEmailBanned } from "./is-email-banned";

describe("isEmailBanned", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false for a null/empty email without hitting the db", async () => {
    expect(await isEmailBanned(null)).toBe(false);
    expect(await isEmailBanned(undefined)).toBe(false);
    expect(await isEmailBanned("")).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns true when the email is blacklisted", async () => {
    findUnique.mockResolvedValueOnce({ id: "b1", email: "x@y.z" });
    expect(await isEmailBanned("x@y.z")).toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { email: "x@y.z" } });
  });

  it("returns false when not blacklisted", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await isEmailBanned("ok@y.z")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/auth/is-email-banned.test.ts` → module not found.

- [ ] **Step 3: Write `src/auth/is-email-banned.ts`**

```ts
import { prisma } from "@/lib/prisma";

/** True when the email is on the persistent ban blacklist. Empty → false. */
export async function isEmailBanned(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) {
    return false;
  }
  const row = await prisma.bannedEmail.findUnique({ where: { email } });
  return row !== null;
}
```

- [ ] **Step 4: Run, expect PASS** (3 tests).

- [ ] **Step 5: Wire into `src/auth/config.ts`**

Add the import (correct order, after the other `@/` imports): `import { isEmailBanned } from "./is-email-banned";` (relative import, grouped with `./send-magic-link`). Replace the `callbacks` block with:
```ts
  callbacks: {
    async signIn({ user }) {
      // Block sign-in (and fresh sign-ups) for blacklisted emails.
      return !(await isEmailBanned(user.email));
    },
    // Database session strategy: `user` is the full Prisma User row.
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.banned = user.banned;
      return session;
    },
  },
```

- [ ] **Step 6: Extend `types/next-auth.d.ts`**

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "MODERATOR" | "ADMIN";
      banned: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: "USER" | "MODERATOR" | "ADMIN";
    banned: boolean;
  }
}
```

- [ ] **Step 7: Guard banned users in `src/auth/guards.ts`**

In `requireUser`, after the existing `if (!session?.user)` redirect, add a banned check so it reads:
```ts
export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect(AUTH.SIGN_IN_PATH);
  }
  if (session.user.banned) {
    redirect(`${AUTH.SIGN_IN_PATH}?banned=1`);
  }
  return session;
}
```
(Leave `requireModerator`/`requireAdmin` unchanged — they call `requireUser`.)

- [ ] **Step 8: Show the banned notice on `/signin`**

In `src/app/signin/page.tsx`: add `banned?: string` to the `searchParams` type; destructure `banned`; and above the form (near the `error` notice) add:
```tsx
{banned ? (
  <p role="alert" className="mb-4 text-destructive text-sm">
    This account has been banned.
  </p>
) : null}
```

- [ ] **Step 9: Typecheck + lint + run the auth test**

Run: `npx vitest run src/auth/is-email-banned.test.ts && npm run typecheck && npm run lint`
Expected: test passes; typecheck exit 0; lint only the pre-existing `cat-image-carousel.tsx` warning.
NOTE: adding the required `banned: boolean` to the augmented `Session["user"]` can make an EXISTING test that builds a `Session`-typed literal without `banned` fail typecheck (e.g. `src/auth/guards.test.ts`). If typecheck flags any such mock, add `banned: false` to that Session mock object. (Route tests that use untyped `vi.fn()` auth mocks are unaffected.) Include any such test edits in this task's commit.

- [ ] **Step 10: Commit**

```bash
git add src/auth/is-email-banned.ts src/auth/is-email-banned.test.ts src/auth/config.ts types/next-auth.d.ts src/auth/guards.ts src/app/signin/page.tsx
git commit -m "feat(auth): email blacklist at sign-in + banned flag in session + guard"
```

---

### Task 3: Admin user actions

**Files:** Modify `src/lib/constants.ts`; Create `src/admin/user-actions.ts`, `src/admin/user-actions.test.ts`

- [ ] **Step 1: Add the page-size constant to `src/lib/constants.ts`**

Append:
```ts
// Admin users table — rows per page
export const ADMIN_USERS_PAGE_SIZE = 20;
```

- [ ] **Step 2: Write the failing test `src/admin/user-actions.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  deleteObjectsMock,
  userFindUnique,
  userUpdate,
  catImageFindMany,
  catDeleteMany,
  bannedUpsert,
  bannedDeleteMany,
  sessionDeleteMany,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  deleteObjectsMock: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  catImageFindMany: vi.fn(),
  catDeleteMany: vi.fn(),
  bannedUpsert: vi.fn(),
  bannedDeleteMany: vi.fn(),
  sessionDeleteMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/guards", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/r2", () => ({ deleteObjects: deleteObjectsMock, publicUrl: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate },
    catImage: { findMany: catImageFindMany },
    cat: { deleteMany: catDeleteMany },
    bannedEmail: { upsert: bannedUpsert, deleteMany: bannedDeleteMany },
    session: { deleteMany: sessionDeleteMany },
  },
}));

import { banUser, setUserRole, unbanUser } from "./user-actions";

const ADMIN = { user: { id: "admin_1", role: "ADMIN" }, expires: "2999-01-01" };

describe("admin user-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(ADMIN);
    userFindUnique.mockResolvedValue({ id: "u1", email: "u@x.z", role: "USER" });
    catImageFindMany.mockResolvedValue([{ id: "img_a" }]);
  });

  describe("banUser", () => {
    it("blacklists email, deletes cats + R2, drops sessions, flags user", async () => {
      const res = await banUser("u1");
      expect(res).toEqual({ ok: true });
      expect(deleteObjectsMock).toHaveBeenCalledWith([
        "cats/img_a/original",
        "cats/img_a/thumb.webp",
        "cats/img_a/card.webp",
      ]);
      expect(catDeleteMany).toHaveBeenCalledWith({ where: { ownerId: "u1" } });
      expect(bannedUpsert).toHaveBeenCalledWith({
        where: { email: "u@x.z" },
        create: { email: "u@x.z", bannedById: "admin_1" },
        update: { bannedById: "admin_1" },
      });
      expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { banned: true, bannedAt: expect.any(Date) },
      });
    });

    it("refuses to ban yourself", async () => {
      const res = await banUser("admin_1");
      expect(res).toEqual({ ok: false, error: "self" });
      expect(catDeleteMany).not.toHaveBeenCalled();
    });

    it("refuses to ban an ADMIN", async () => {
      userFindUnique.mockResolvedValueOnce({ id: "u1", email: "a@x.z", role: "ADMIN" });
      const res = await banUser("u1");
      expect(res).toEqual({ ok: false, error: "admin" });
      expect(catDeleteMany).not.toHaveBeenCalled();
    });

    it("returns not_found for a missing user", async () => {
      userFindUnique.mockResolvedValueOnce(null);
      const res = await banUser("u1");
      expect(res).toEqual({ ok: false, error: "not_found" });
    });
  });

  describe("unbanUser", () => {
    it("clears blacklist + banned flag", async () => {
      userFindUnique.mockResolvedValueOnce({ email: "u@x.z" });
      const res = await unbanUser("u1");
      expect(res).toEqual({ ok: true });
      expect(bannedDeleteMany).toHaveBeenCalledWith({ where: { email: "u@x.z" } });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { banned: false, bannedAt: null },
      });
    });
  });

  describe("setUserRole", () => {
    it("updates a USER to MODERATOR", async () => {
      const res = await setUserRole("u1", "MODERATOR");
      expect(res).toEqual({ ok: true });
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { role: "MODERATOR" },
      });
    });
    it("rejects an invalid role", async () => {
      const res = await setUserRole("u1", "SUPERADMIN");
      expect(res).toEqual({ ok: false, error: "invalid_role" });
    });
    it("refuses to change your own role", async () => {
      const res = await setUserRole("admin_1", "USER");
      expect(res).toEqual({ ok: false, error: "self" });
    });
    it("refuses to change an ADMIN", async () => {
      userFindUnique.mockResolvedValueOnce({ role: "ADMIN" });
      const res = await setUserRole("u1", "USER");
      expect(res).toEqual({ ok: false, error: "admin" });
    });
  });
});
```

- [ ] **Step 3: Run, expect FAIL** — `npx vitest run src/admin/user-actions.test.ts`.

- [ ] **Step 4: Write `src/admin/user-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/auth/guards";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/r2";
import { cardKey, originalKey, thumbKey } from "@/storage/keys";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const USERS_PATH = "/admin/users";
const RoleSchema = z.enum(["USER", "MODERATOR"]);

function imageObjectKeys(imageId: string): string[] {
  return [originalKey(imageId), thumbKey(imageId), cardKey(imageId)];
}

export async function banUser(userId: string): Promise<AdminActionResult> {
  const session = await requireAdmin();
  if (userId === session.user.id) {
    return { ok: false, error: "self" };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    return { ok: false, error: "not_found" };
  }
  if (user.role === "ADMIN") {
    return { ok: false, error: "admin" };
  }

  // Best-effort R2 cleanup for every image of every cat the user owns.
  const images = await prisma.catImage.findMany({
    where: { cat: { ownerId: userId } },
    select: { id: true },
  });
  await deleteObjects(images.flatMap((img) => imageObjectKeys(img.id)));

  await prisma.cat.deleteMany({ where: { ownerId: userId } });
  if (user.email) {
    await prisma.bannedEmail.upsert({
      where: { email: user.email },
      create: { email: user.email, bannedById: session.user.id },
      update: { bannedById: session.user.id },
    });
  }
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { banned: true, bannedAt: new Date() },
  });
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function unbanUser(userId: string): Promise<AdminActionResult> {
  await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    return { ok: false, error: "not_found" };
  }
  if (user.email) {
    await prisma.bannedEmail.deleteMany({ where: { email: user.email } });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { banned: false, bannedAt: null },
  });
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function setUserRole(
  userId: string,
  role: string,
): Promise<AdminActionResult> {
  const session = await requireAdmin();
  if (userId === session.user.id) {
    return { ok: false, error: "self" };
  }
  const parsed = RoleSchema.safeParse(role);
  if (!parsed.success) {
    return { ok: false, error: "invalid_role" };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) {
    return { ok: false, error: "not_found" };
  }
  if (user.role === "ADMIN") {
    return { ok: false, error: "admin" };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { role: parsed.data },
  });
  revalidatePath(USERS_PATH);
  return { ok: true };
}
```

- [ ] **Step 5: Run, expect PASS** (9 tests). Then `npm run typecheck && npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/admin/user-actions.ts src/admin/user-actions.test.ts src/lib/constants.ts
git commit -m "feat(admin): banUser/unbanUser/setUserRole actions with admin/self guards"
```

---

### Task 4: Reusable DataTable

**Files:** Create `src/components/ui/data-table.tsx`, `src/components/ui/data-table.test.tsx`

- [ ] **Step 1: Install deps + shadcn table + select**

Run: `npm i @tanstack/react-table` then `npx shadcn@latest add table select --yes`
Expected: `@tanstack/react-table` in dependencies; `src/components/ui/table.tsx` and `src/components/ui/select.tsx` created. (These are new files — no overwrite prompts.)

- [ ] **Step 2: Write the failing test `src/components/ui/data-table.test.tsx`**

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "./data-table";

type Row = { id: string; name: string };
const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
];

describe("DataTable", () => {
  it("renders header and rows", () => {
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Mittens" }]}
        pageIndex={0}
        pageCount={1}
        basePath="/x"
      />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Mittens")).toBeInTheDocument();
  });

  it("renders an empty state with no rows", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pageIndex={0}
        pageCount={1}
        basePath="/x"
      />,
    );
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, expect FAIL** — `npx vitest run src/components/ui/data-table.test.tsx`.

- [ ] **Step 4: Write `src/components/ui/data-table.tsx`**

```tsx
"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageIndex: number; // 0-based
  pageCount: number;
  basePath: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  pageIndex,
  pageCount,
  basePath,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });
  const page = pageIndex + 1;
  const totalPages = Math.max(pageCount, 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}?page=${page - 1}`}>Previous</Link>
            </Button>
          )}
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}?page=${page + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run, expect PASS** (2 tests). Then `npm run typecheck && npm run lint` (run `npm run format` if Biome reorders imports).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/data-table.tsx src/components/ui/data-table.test.tsx src/components/ui/table.tsx src/components/ui/select.tsx package.json package-lock.json
git commit -m "feat(ui): reusable TanStack DataTable + shadcn table/select"
```

---

### Task 5: Admin sidebar shell

**Files:** Create `src/components/admin/admin-sidebar.tsx`, `src/app/admin/layout.tsx`

- [ ] **Step 1: Install shadcn sidebar**

Run: `printf 'n\nn\nn\nn\nn\nn\nn\nn\n' | npx shadcn@latest add sidebar --yes`
Expected: `src/components/ui/sidebar.tsx` created (plus any missing deps like `sheet`, `tooltip`, `skeleton`, `separator`). The `printf 'n'` answers "No" to any prompt offering to OVERWRITE existing files (`button.tsx`, `input.tsx`) — keep ours. Verify `src/components/ui/sidebar.tsx` exists and `git status` shows `button.tsx`/`input.tsx` UNCHANGED. If the CLI still couldn't complete non-interactively, report BLOCKED with the output.

- [ ] **Step 2: Write `src/components/admin/admin-sidebar.tsx`** (client — needs `usePathname`)

```tsx
"use client";

import { Gauge, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type AdminSidebarProps = {
  isAdmin: boolean;
};

export function AdminSidebar({ isAdmin }: AdminSidebarProps) {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/admin"}>
                  <Link href="/admin">
                    <Gauge />
                    <span>Moderation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/users")}
                  >
                    <Link href="/admin/users">
                      <Users />
                      <span>Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
```

- [ ] **Step 3: Write `src/app/admin/layout.tsx`** (server — gates + reads role)

```tsx
import { requireModerator } from "@/auth/guards";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireModerator();
  const isAdmin = session.user.role === "ADMIN";

  return (
    <SidebarProvider>
      <AdminSidebar isAdmin={isAdmin} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="font-semibold">Admin</span>
        </header>
        <div className="p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 4: Typecheck + lint** (`npm run typecheck && npm run lint`; `npm run format` if needed). The existing `src/app/admin/page.tsx` now renders inside this layout — no change needed to it.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-sidebar.tsx src/app/admin/layout.tsx src/components/ui/sidebar.tsx src/components/ui/sheet.tsx src/components/ui/tooltip.tsx src/components/ui/skeleton.tsx src/components/ui/separator.tsx package.json package-lock.json
git commit -m "feat(admin): sidebar shell layout (Moderation + Users nav)"
```
(Use `git add src/components/ui` to include whatever new ui files the sidebar pulled in; do NOT add modified `button.tsx`/`input.tsx` — they should be unchanged.)

---

### Task 6: Users page + row actions

**Files:** Create `src/components/admin/user-row-actions.tsx`, `src/components/admin/users-table.tsx`, `src/app/admin/users/page.tsx`

- [ ] **Step 1: Write `src/components/admin/user-row-actions.tsx`** (client)

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { banUser, setUserRole, unbanUser } from "@/admin/user-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  banned: boolean;
  cats: number;
  joined: string;
};

export function UserRowActions({
  user,
  currentUserId,
}: {
  user: AdminUserRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // ADMINs and yourself cannot be acted on.
  if (user.role === "ADMIN" || user.id === currentUserId) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  async function onRole(role: string): Promise<void> {
    setBusy(true);
    const result = await setUserRole(user.id, role);
    setBusy(false);
    if (result.ok) {
      toast.success("Role updated");
      router.refresh();
    } else {
      toast.error(`Could not change role (${result.error})`);
    }
  }

  async function onBanToggle(): Promise<void> {
    if (
      !user.banned &&
      !window.confirm(
        `Ban ${user.email ?? "this user"}? Their cats will be deleted.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const result = user.banned
      ? await unbanUser(user.id)
      : await banUser(user.id);
    setBusy(false);
    if (result.ok) {
      toast.success(user.banned ? "User unbanned" : "User banned");
      router.refresh();
    } else {
      toast.error(`Action failed (${result.error})`);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        defaultValue={user.role}
        disabled={busy}
        onValueChange={(v) => void onRole(v)}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="USER">User</SelectItem>
          <SelectItem value="MODERATOR">Moderator</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={user.banned ? "outline" : "destructive"}
        disabled={busy}
        onClick={() => void onBanToggle()}
      >
        {user.banned ? "Unban" : "Ban"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/admin/users-table.tsx`** (client — column defs + DataTable)

```tsx
"use client";

import type { ColumnDef } from "@tanstack/react-table";

import {
  type AdminUserRow,
  UserRowActions,
} from "@/components/admin/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

function buildColumns(currentUserId: string): ColumnDef<AdminUserRow>[] {
  return [
    {
      accessorKey: "email",
      header: "User",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.email ?? "—"}</span>
          {row.original.name ? (
            <span className="text-muted-foreground text-xs">
              {row.original.name}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <Badge variant="secondary">{row.original.role}</Badge>,
    },
    { accessorKey: "cats", header: "Cats" },
    {
      accessorKey: "banned",
      header: "Status",
      cell: ({ row }) =>
        row.original.banned ? (
          <Badge variant="destructive">banned</Badge>
        ) : (
          <Badge variant="outline">active</Badge>
        ),
    },
    {
      accessorKey: "joined",
      header: "Joined",
      cell: ({ row }) =>
        new Date(row.original.joined).toLocaleDateString(),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <UserRowActions user={row.original} currentUserId={currentUserId} />
      ),
    },
  ];
}

export function UsersTable({
  rows,
  pageIndex,
  pageCount,
  currentUserId,
}: {
  rows: AdminUserRow[];
  pageIndex: number;
  pageCount: number;
  currentUserId: string;
}) {
  return (
    <DataTable
      columns={buildColumns(currentUserId)}
      data={rows}
      pageIndex={pageIndex}
      pageCount={pageCount}
      basePath="/admin/users"
    />
  );
}
```

- [ ] **Step 3: Write `src/app/admin/users/page.tsx`** (server — paginated query)

```tsx
import { requireAdmin } from "@/auth/guards";
import type { AdminUserRow } from "@/components/admin/user-row-actions";
import { UsersTable } from "@/components/admin/users-table";
import { ADMIN_USERS_PAGE_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireAdmin();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const skip = (page - 1) * ADMIN_USERS_PAGE_SIZE;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        createdAt: true,
        _count: { select: { cats: true } },
      },
    }),
    prisma.user.count(),
  ]);

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    banned: u.banned,
    cats: u._count.cats,
    joined: u.createdAt.toISOString(),
  }));

  const pageCount = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));

  return (
    <main>
      <h1 className="mb-1 font-bold text-2xl tracking-tight">Users</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        {total} users · manage roles and bans.
      </p>
      <UsersTable
        rows={rows}
        pageIndex={page - 1}
        pageCount={pageCount}
        currentUserId={session.user.id}
      />
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + lint** (`npm run typecheck && npm run lint`; `npm run format` if needed).
Note: the `Select` `SelectTrigger` `size="sm"` prop exists in the current shadcn select; if typecheck complains that `size` is not a prop, drop it (use default trigger).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/user-row-actions.tsx src/components/admin/users-table.tsx src/app/admin/users/page.tsx
git commit -m "feat(admin): users page with paginated DataTable, role + ban/unban actions"
```

---

### Task 7: Full-slice verification

**Files:** none (temporary preview route, removed before finishing)

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS — all suites green (previous 117 + new: is-email-banned (3), user-actions (9), data-table (2) = 131 total).

- [ ] **Step 2: Typecheck + lint + CSS**

Run: `npm run typecheck && npm run lint && npm run lint:css`
Expected: typecheck exit 0; Biome only the pre-existing `cat-image-carousel.tsx` warning; Stylelint clean.

- [ ] **Step 3: Dev smoke screenshot (admin is gated)**

Create a throwaway `src/app/style-preview/page.tsx` that renders `<UsersTable rows={MOCK} pageIndex={0} pageCount={3} currentUserId="other" />` with 2-3 mock `AdminUserRow`s (one ADMIN, one banned, one normal) inside a `<SidebarProvider>` + `<AdminSidebar isAdmin />` + `<SidebarInset>`. `npm run dev`, screenshot `/style-preview`, confirm the sidebar + users table render cleanly, then DELETE `src/app/style-preview`, clear `.next`, and stop the server.

- [ ] **Step 4: Confirm clean tree + final commit (if any)**

```bash
git status --short   # should show nothing untracked but .claude/settings.json
```
