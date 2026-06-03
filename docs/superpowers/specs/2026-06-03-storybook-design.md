# Storybook — Design Spec

> Stand up Storybook for cat-arena and author stories for the core UI primitives,
> the app components, and page-level view compositions. Storybook documents/exercises
> the **client-renderable** UI; server actions are mocked, server-only data is faked.

**Status:** approved 2026-06-03.

## Goals

- Storybook 9 running on **`@storybook/nextjs-vite`** (Next 15 + React 19 + Tailwind v4).
- Stories for: all shadcn UI primitives, the app components, and page-view compositions
  (Sign in, 404, Error, Dashboard, Admin·Moderation, Admin·Users, Upload) on mock data.
- Components that call **server actions** render in Storybook via mocked action modules
  (`fn()` spies) — interactions log to the Actions panel, no real server calls.
- `build-storybook` produces a clean static build.

## Non-goals

- Chromatic / visual-regression, CI publishing, `@storybook/test-runner` interaction tests.
- Storying the real async Server Component pages (they need auth/DB) — we story their
  presentational client compositions instead.

## Architecture

- **Framework:** `@storybook/nextjs-vite` (Vite builder + Next mocks for `next/navigation`,
  `next/image`, `next/font`). Stories co-located as `src/**/*.stories.tsx`.
- **Tailwind v4:** `.storybook/preview.ts` imports `src/app/globals.css`. Vite auto-applies
  the project's `postcss.config.mjs` (`@tailwindcss/postcss`) so theme tokens resolve. If
  Vite does not pick up PostCSS, fall back to adding `@tailwindcss/vite` in `viteFinal`.
- **Theme decorator:** a global decorator wraps each story in the app surface
  (`bg-background text-foreground` + Geist font vars) and a toolbar toggle adds/removes the
  `.dark` class on the preview root for light/dark.
- **Server-action mocking (key):** `.storybook/main.ts` `viteFinal` sets `resolve.alias` for
  the four action modules to mock files under `.storybook/mocks/`:
  - `@/cats/owner-actions` → `renameCat`/`addCatImage`/`deleteCatImage`/`deleteCatOwned`
  - `@/admin/user-actions` → `banUser`/`unbanUser`/`setUserRole`
  - `@/moderation/moderation-actions` → `approveImageAction`/`rejectImageAction`/`approveAllAction`/`hideCatAction`/`banCatAction`/`deleteCatAction`
  - `@/moderation/moderation-queue` → `getModerationCats`
  Each mock exports the same names as `fn()` spies (from `storybook/test`) resolving to
  `{ ok: true }` (or an empty page for `getModerationCats`). This keeps `"use server"`
  modules out of the browser bundle and logs interactions.

## Story coverage (full)

- **UI primitives** (`src/components/ui/*.stories.tsx`): button, badge, input, card, select,
  table, alert-dialog, skeleton, separator, tooltip, sonner (Toaster + a trigger), data-table.
- **App components**: dashboard/{cat-card, rename-cat-form, add-image, status-badge},
  admin/{moderation-card, moderation-list, user-row-actions, users-table, confirm-button},
  upload/{image-dropzone, upload-form}, site-header, duel/{cat-image-carousel, cat-card,
  vote-button}.
- **Page views** (`src/stories/pages/*.stories.tsx` or co-located): SignIn, NotFound, Error,
  Dashboard (CatCard grid), Moderation (ModerationList), Users (UsersTable), Upload (UploadForm
  in a Card). Built from the client pieces + fixtures; the real async pages are not imported.
- **Fixtures**: shared mock data (cats, images via `https://placecats.com/<w>/<h>`, users,
  moderation page) under `.storybook/fixtures.ts` or per-story.

Each story file: a `Meta` (title, component, tags: ["autodocs"]) + 2-5 variants covering states
(default, disabled, variants/sizes, empty, loading, banned/admin where relevant). Callbacks use
`fn()`; `args`/`argTypes` for primitives so the Controls panel is useful.

## Scripts & verification

- `package.json`: `"storybook": "storybook dev -p 6006"`, `"build-storybook": "storybook build"`.
- Done = `build-storybook` exits 0 (no story import/build errors) + a dev screenshot of the
  Button + a page-view story renders correctly with Tailwind theme applied.
- Biome lints `*.stories.tsx` (keep clean). The ESLint Tailwind rule also covers them.
- Not wired into pre-commit (Storybook build is heavy) — run on demand / future CI.

## Touched / new

- New: `.storybook/{main.ts,preview.ts,fixtures.ts,mocks/*.ts}`, `src/**/*.stories.tsx`.
- Modified: `package.json` (scripts + Storybook devDeps), possibly `.gitignore`
  (`storybook-static/`), `.vscode/extensions.json` (recommend `storybook.storybook` ext).
- No app/source behavior changes — Storybook is additive.
