# Owner Cabinet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in owner manages their own cats at `/dashboard` — view, rename, add/delete images ("replace" = delete+add), and delete the cat — all owner-scoped and bug-free.

**Architecture:** `/dashboard` is a Server Component reading the owner's cats via Prisma. Mutations are owner-guarded **Server Actions** (`renameCat`, `addCatImage`, `deleteCatImage`, `deleteCatOwned`) that `revalidatePath('/dashboard')` and return a typed `{ ok }` result; client controls toast the result and `router.refresh()`. Adding a photo reuses the presign→PUT flow then calls `addCatImage`. The per-image "process+screen" logic is extracted into a shared `ingest-image` helper reused by `POST /api/cats`. **Functional-first: UI is minimal/accessible, no visual polish (a redesign pass comes later).**

**Tech Stack:** Next.js 15 App Router (RSC + Server Actions), Prisma, `@aws-sdk/client-s3` (R2), Zod, Sonner toasts, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-owner-cabinet-design.md`. No DB migration.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/r2.ts` | (MODIFY) add `deleteObjects(keys[])` — batch DeleteObjects, best-effort |
| `src/lib/r2.test.ts` | (NEW) `deleteObjects` sends the right command; tolerates send failure |
| `src/storage/ingest-image.ts` | (NEW) `ingestImage(imageId)` → `{width,height,status}` (processImage + screenImage) |
| `src/storage/ingest-image.test.ts` | (NEW) returns processed dims + screened status |
| `src/app/api/cats/route.ts` | (MODIFY) use `ingestImage` instead of inline process+screen |
| `src/cats/owner-guard.ts` | (NEW) `requireOwnedCat(catId)` → typed owned/forbidden/not_found result |
| `src/cats/owner-guard.test.ts` | (NEW) ok / not_found / forbidden |
| `src/cats/owner-actions.ts` | (NEW) `renameCat`, `addCatImage`, `deleteCatImage`, `deleteCatOwned` |
| `src/cats/owner-actions.test.ts` | (NEW) ownership, caps, last-image, BANNED rules, R2 cleanup |
| `src/components/upload/upload-to-r2.ts` | (NEW) extract client `uploadToR2(file)` (sign→PUT) from upload-form |
| `src/components/upload/upload-form.tsx` | (MODIFY) use `uploadToR2` |
| `src/app/dashboard/page.tsx` | (NEW) RSC: requireUser, list owned cats, render grid |
| `src/components/dashboard/cat-card.tsx` | (NEW) client: one cat — status, images, controls |
| `src/components/dashboard/rename-cat-form.tsx` | (NEW) client: inline rename |
| `src/components/dashboard/add-image.tsx` | (NEW) client: add a photo (reuse ImageDropzone + uploadToR2) |
| `src/components/site-header.tsx` | (MODIFY) add "My cats" link when signed in |

Assumed present (DO NOT recreate): `src/auth/guards.ts` (`requireUser`), `src/lib/prisma.ts`, `src/lib/env.ts`, `src/storage/keys.ts` (`originalKey`/`thumbKey`/`cardKey`), `src/storage/process-image.ts` (`processImage`), `src/moderation/screen-image.ts` (`screenImage`), `src/components/upload/image-dropzone.tsx` (`ImageDropzone`), `src/lib/constants.ts` (`MAX_CATS_PER_USER`, `MAX_IMAGES_PER_CAT`), Sonner `toast` (`sonner`).

---

### Task 1: R2 `deleteObjects` helper

**Files:** Modify `src/lib/r2.ts`; Create `src/lib/r2.test.ts`

- [ ] **Step 1: Write the failing test `src/lib/r2.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendMock;
  },
  PutObjectCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  DeleteObjectsCommand: class {
    input: { Bucket?: string; Delete?: { Objects?: Array<{ Key: string }> } };
    constructor(input: {
      Bucket?: string;
      Delete?: { Objects?: Array<{ Key: string }> };
    }) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));

vi.mock("@/lib/env", () => ({
  env: {
    R2_ACCOUNT_ID: "acct",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "bucket",
    R2_PUBLIC_URL: "https://cdn.test",
  },
}));

import { deleteObjects } from "./r2";

describe("deleteObjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a DeleteObjectsCommand with all keys", async () => {
    sendMock.mockResolvedValueOnce({});
    await deleteObjects(["cats/a/original", "cats/a/thumb.webp"]);
    expect(sendMock).toHaveBeenCalledOnce();
    const command = sendMock.mock.calls[0]?.[0] as {
      input: { Bucket: string; Delete: { Objects: Array<{ Key: string }> } };
    };
    expect(command.input.Bucket).toBe("bucket");
    expect(command.input.Delete.Objects).toEqual([
      { Key: "cats/a/original" },
      { Key: "cats/a/thumb.webp" },
    ]);
  });

  it("does nothing when given no keys", async () => {
    await deleteObjects([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never throws even if the R2 send fails (best-effort cleanup)", async () => {
    sendMock.mockRejectedValueOnce(new Error("network"));
    await expect(
      deleteObjects(["cats/a/original"]),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `npx vitest run src/lib/r2.test.ts`
Expected: FAIL — `deleteObjects` is not exported.

- [ ] **Step 3: Add `deleteObjects` to `src/lib/r2.ts`**

Add `DeleteObjectsCommand` to the existing `@aws-sdk/client-s3` import (keep `PutObjectCommand`, `S3Client`), and append this function after `presignPut` (do NOT remove existing `r2`, `presignPut`, `publicUrl`):

```ts
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
```

```ts
/**
 * Delete R2 objects by key. Best-effort: storage cleanup must never fail a
 * user-facing DB mutation, so send errors are swallowed (objects may orphan).
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  try {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  } catch {
    // Orphaned objects are acceptable; the user action already succeeded.
  }
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `npx vitest run src/lib/r2.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Typecheck + lint touched files**

Run: `npm run typecheck && npm run lint`
Expected: typecheck exit 0; Biome only the pre-existing `cat-image-carousel.tsx` `<img>` warning. (Run `npm run format` if Biome reorders the new import.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/r2.ts src/lib/r2.test.ts
git commit -m "feat(storage): r2 deleteObjects best-effort cleanup helper"
```

---

### Task 2: `ingest-image` helper + refactor `POST /api/cats`

**Files:** Create `src/storage/ingest-image.ts`, `src/storage/ingest-image.test.ts`; Modify `src/app/api/cats/route.ts`

- [ ] **Step 1: Write the failing test `src/storage/ingest-image.test.ts`**

```ts
import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { processMock, screenMock } = vi.hoisted(() => ({
  processMock: vi.fn(),
  screenMock: vi.fn(),
}));

vi.mock("@/storage/process-image", () => ({ processImage: processMock }));
vi.mock("@/moderation/screen-image", () => ({ screenImage: screenMock }));

import { ingestImage } from "./ingest-image";

describe("ingestImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processMock.mockResolvedValue({
      width: 800,
      height: 600,
      screenBuffer: Buffer.from([1]),
    });
    screenMock.mockResolvedValue("APPROVED");
  });

  it("processes then screens, returning dims and status", async () => {
    const result = await ingestImage("img_1");
    expect(processMock).toHaveBeenCalledWith("img_1");
    expect(screenMock).toHaveBeenCalledWith(Buffer.from([1]));
    expect(result).toEqual({ width: 800, height: 600, status: "APPROVED" });
  });

  it("passes through a PENDING screen verdict", async () => {
    screenMock.mockResolvedValueOnce("PENDING");
    const result = await ingestImage("img_2");
    expect(result.status).toBe("PENDING");
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `npx vitest run src/storage/ingest-image.test.ts`
Expected: FAIL — `Cannot find module './ingest-image'`.

- [ ] **Step 3: Write `src/storage/ingest-image.ts`**

```ts
import { screenImage } from "@/moderation/screen-image";
import { processImage } from "@/storage/process-image";

import type { ImageStatus } from "@prisma/client";

export type ScreenedImage = {
  width: number;
  height: number;
  status: ImageStatus;
};

/**
 * Derive WebP variants for an already-uploaded original (cats/<imageId>/original)
 * and auto-screen it. Returns the intrinsic dimensions and the moderation status.
 * Shared by POST /api/cats (create) and addCatImage (cabinet).
 */
export async function ingestImage(imageId: string): Promise<ScreenedImage> {
  const { width, height, screenBuffer } = await processImage(imageId);
  const status = await screenImage(screenBuffer);
  return { width, height, status };
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `npx vitest run src/storage/ingest-image.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Refactor `src/app/api/cats/route.ts` to use `ingestImage`**

Read the file first. In the imports, REMOVE `import { screenImage } from "@/moderation/screen-image";` and `import { processImage } from "@/storage/process-image";` and the now-unused `import type { ImageStatus } from "@prisma/client";`; ADD `import { ingestImage } from "@/storage/ingest-image";` (keep import ordering). Then replace the `processed` map body:

REPLACE:
```ts
    const processed = await Promise.all(
      images.map(async (img, index) => {
        const id = imageIdFromKey(img.r2Key);
        const { width, height, screenBuffer } = await processImage(id);
        const status: ImageStatus = await screenImage(screenBuffer);
        return { id, r2Key: img.r2Key, width, height, position: index, status };
      }),
    );
```
WITH:
```ts
    const processed = await Promise.all(
      images.map(async (img, index) => {
        const id = imageIdFromKey(img.r2Key);
        const { width, height, status } = await ingestImage(id);
        return { id, r2Key: img.r2Key, width, height, position: index, status };
      }),
    );
```

- [ ] **Step 6: Run the cats route test, expect STILL PASS**

Run: `npx vitest run src/app/api/cats/route.test.ts`
Expected: PASS — 5 tests (the route test mocks `@/storage/process-image` + `@/moderation/screen-image`, which `ingestImage` calls; behavior unchanged).

- [ ] **Step 7: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck exit 0; lint only the pre-existing warning.

- [ ] **Step 8: Commit**

```bash
git add src/storage/ingest-image.ts src/storage/ingest-image.test.ts src/app/api/cats/route.ts
git commit -m "refactor(storage): extract ingestImage; reuse in POST /api/cats"
```

---

### Task 3: `requireOwnedCat` owner guard

**Files:** Create `src/cats/owner-guard.ts`, `src/cats/owner-guard.test.ts`

- [ ] **Step 1: Write the failing test `src/cats/owner-guard.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock, findUniqueMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock("@/auth/guards", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { cat: { findUnique: findUniqueMock } },
}));

import { requireOwnedCat } from "./owner-guard";

const SESSION = { user: { id: "user_1", role: "USER" }, expires: "2999-01-01" };

describe("requireOwnedCat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(SESSION);
  });

  it("returns not_found when the cat does not exist", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const result = await requireOwnedCat("cat_x");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("returns forbidden when the cat belongs to another user", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "cat_1",
      ownerId: "user_2",
      status: "ACTIVE",
    });
    const result = await requireOwnedCat("cat_1");
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("returns ok with the cat when owned by the session user", async () => {
    const cat = { id: "cat_1", ownerId: "user_1", status: "ACTIVE" };
    findUniqueMock.mockResolvedValueOnce(cat);
    const result = await requireOwnedCat("cat_1");
    expect(result).toEqual({ ok: true, session: SESSION, cat });
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `npx vitest run src/cats/owner-guard.test.ts`
Expected: FAIL — `Cannot find module './owner-guard'`.

- [ ] **Step 3: Write `src/cats/owner-guard.ts`**

```ts
import { requireUser } from "@/auth/guards";
import { prisma } from "@/lib/prisma";

import type { CatStatus } from "@prisma/client";
import type { Session } from "next-auth";

export type OwnedCat = {
  id: string;
  ownerId: string;
  status: CatStatus;
};

export type OwnedCatResult =
  | { ok: true; session: Session; cat: OwnedCat }
  | { ok: false; error: "not_found" | "forbidden" };

/**
 * Require a signed-in user (redirects if none) who owns `catId`. Returns a typed
 * result so server actions can surface not_found/forbidden as toasts, not throws.
 */
export async function requireOwnedCat(catId: string): Promise<OwnedCatResult> {
  const session = await requireUser();
  const cat = await prisma.cat.findUnique({
    where: { id: catId },
    select: { id: true, ownerId: true, status: true },
  });
  if (!cat) {
    return { ok: false, error: "not_found" };
  }
  if (cat.ownerId !== session.user.id) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, session, cat };
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `npx vitest run src/cats/owner-guard.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Typecheck + lint, then commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/cats/owner-guard.ts src/cats/owner-guard.test.ts
git commit -m "feat(cats): requireOwnedCat owner guard"
```

---

### Task 4: Owner server actions

**Files:** Create `src/cats/owner-actions.ts`, `src/cats/owner-actions.test.ts`

- [ ] **Step 1: Write the failing test `src/cats/owner-actions.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnedCatMock,
  ingestMock,
  deleteObjectsMock,
  catUpdate,
  catDelete,
  imageFindMany,
  imageFindUnique,
  imageCreate,
  imageDelete,
  imageCount,
} = vi.hoisted(() => ({
  requireOwnedCatMock: vi.fn(),
  ingestMock: vi.fn(),
  deleteObjectsMock: vi.fn(),
  catUpdate: vi.fn(),
  catDelete: vi.fn(),
  imageFindMany: vi.fn(),
  imageFindUnique: vi.fn(),
  imageCreate: vi.fn(),
  imageDelete: vi.fn(),
  imageCount: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/cats/owner-guard", () => ({ requireOwnedCat: requireOwnedCatMock }));
vi.mock("@/storage/ingest-image", () => ({ ingestImage: ingestMock }));
vi.mock("@/lib/r2", () => ({ deleteObjects: deleteObjectsMock, publicUrl: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cat: { update: catUpdate, delete: catDelete },
    catImage: {
      findMany: imageFindMany,
      findUnique: imageFindUnique,
      create: imageCreate,
      delete: imageDelete,
      count: imageCount,
    },
  },
}));

import {
  addCatImage,
  deleteCatImage,
  deleteCatOwned,
  renameCat,
} from "./owner-actions";

const SESSION = { user: { id: "user_1" }, expires: "2999-01-01" };
function owned(status = "ACTIVE") {
  return {
    ok: true,
    session: SESSION,
    cat: { id: "cat_1", ownerId: "user_1", status },
  };
}

describe("owner-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnedCatMock.mockResolvedValue(owned());
    ingestMock.mockResolvedValue({ width: 800, height: 600, status: "PENDING" });
    imageFindMany.mockResolvedValue([{ position: 0 }]);
    imageFindUnique.mockResolvedValue({ id: "img_1", catId: "cat_1" });
    imageCount.mockResolvedValue(2);
  });

  describe("renameCat", () => {
    it("updates name only and succeeds", async () => {
      const res = await renameCat("cat_1", "  New Name  ");
      expect(res).toEqual({ ok: true });
      expect(catUpdate).toHaveBeenCalledWith({
        where: { id: "cat_1" },
        data: { name: "New Name" },
      });
    });
    it("rejects an empty name", async () => {
      const res = await renameCat("cat_1", "   ");
      expect(res).toEqual({ ok: false, error: "invalid_name" });
      expect(catUpdate).not.toHaveBeenCalled();
    });
    it("propagates a forbidden owner-guard result", async () => {
      requireOwnedCatMock.mockResolvedValueOnce({ ok: false, error: "forbidden" });
      const res = await renameCat("cat_1", "X");
      expect(res).toEqual({ ok: false, error: "forbidden" });
    });
    it("refuses to rename a BANNED cat", async () => {
      requireOwnedCatMock.mockResolvedValueOnce(owned("BANNED"));
      const res = await renameCat("cat_1", "X");
      expect(res).toEqual({ ok: false, error: "banned" });
    });
  });

  describe("addCatImage", () => {
    it("creates the image at position max+1 with the screened status", async () => {
      imageFindMany.mockResolvedValueOnce([{ position: 0 }, { position: 1 }]);
      const res = await addCatImage("cat_1", "cats/img_new/original");
      expect(res).toEqual({ ok: true });
      expect(ingestMock).toHaveBeenCalledWith("img_new");
      expect(imageCreate).toHaveBeenCalledWith({
        data: {
          id: "img_new",
          catId: "cat_1",
          r2Key: "cats/img_new/original",
          width: 800,
          height: 600,
          position: 2,
          status: "PENDING",
        },
      });
    });
    it("refuses when the cat already has MAX_IMAGES_PER_CAT images", async () => {
      imageFindMany.mockResolvedValueOnce([
        { position: 0 },
        { position: 1 },
        { position: 2 },
      ]);
      const res = await addCatImage("cat_1", "cats/img_new/original");
      expect(res).toEqual({ ok: false, error: "image_limit" });
      expect(imageCreate).not.toHaveBeenCalled();
    });
    it("rejects a malformed r2Key", async () => {
      const res = await addCatImage("cat_1", "not/a/valid/key");
      expect(res).toEqual({ ok: false, error: "invalid_key" });
    });
    it("refuses on a BANNED cat", async () => {
      requireOwnedCatMock.mockResolvedValueOnce(owned("BANNED"));
      const res = await addCatImage("cat_1", "cats/img_new/original");
      expect(res).toEqual({ ok: false, error: "banned" });
    });
  });

  describe("deleteCatImage", () => {
    it("refuses to delete the last image", async () => {
      imageCount.mockResolvedValueOnce(1);
      const res = await deleteCatImage("img_1");
      expect(res).toEqual({ ok: false, error: "last_image" });
      expect(imageDelete).not.toHaveBeenCalled();
    });
    it("deletes the image and its R2 objects", async () => {
      imageCount.mockResolvedValueOnce(3);
      const res = await deleteCatImage("img_1");
      expect(res).toEqual({ ok: true });
      expect(imageDelete).toHaveBeenCalledWith({ where: { id: "img_1" } });
      expect(deleteObjectsMock).toHaveBeenCalledWith([
        "cats/img_1/original",
        "cats/img_1/thumb.webp",
        "cats/img_1/card.webp",
      ]);
    });
    it("returns not_found when the image is missing", async () => {
      imageFindUnique.mockResolvedValueOnce(null);
      const res = await deleteCatImage("img_x");
      expect(res).toEqual({ ok: false, error: "not_found" });
    });
    it("refuses on a BANNED cat", async () => {
      requireOwnedCatMock.mockResolvedValueOnce(owned("BANNED"));
      imageCount.mockResolvedValueOnce(3);
      const res = await deleteCatImage("img_1");
      expect(res).toEqual({ ok: false, error: "banned" });
    });
  });

  describe("deleteCatOwned", () => {
    it("deletes the cat and all its image R2 objects (allowed even if BANNED)", async () => {
      requireOwnedCatMock.mockResolvedValueOnce(owned("BANNED"));
      imageFindMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
      const res = await deleteCatOwned("cat_1");
      expect(res).toEqual({ ok: true });
      expect(catDelete).toHaveBeenCalledWith({ where: { id: "cat_1" } });
      expect(deleteObjectsMock).toHaveBeenCalledWith([
        "cats/a/original",
        "cats/a/thumb.webp",
        "cats/a/card.webp",
        "cats/b/original",
        "cats/b/thumb.webp",
        "cats/b/card.webp",
      ]);
    });
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `npx vitest run src/cats/owner-actions.test.ts`
Expected: FAIL — `Cannot find module './owner-actions'`.

- [ ] **Step 3: Write `src/cats/owner-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwnedCat } from "@/cats/owner-guard";
import { MAX_IMAGES_PER_CAT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/r2";
import { cardKey, originalKey, thumbKey } from "@/storage/keys";
import { ingestImage } from "@/storage/ingest-image";

export type OwnerActionResult = { ok: true } | { ok: false; error: string };

const DASHBOARD_PATH = "/dashboard";
const MIN_NAME = 1;
const MAX_NAME = 60;
const NameSchema = z.string().trim().min(MIN_NAME).max(MAX_NAME);
const ORIGINAL_KEY = /^cats\/([^/]+)\/original$/;

/** All three R2 objects (original + derived variants) for one image id. */
function imageObjectKeys(imageId: string): string[] {
  return [originalKey(imageId), thumbKey(imageId), cardKey(imageId)];
}

export async function renameCat(
  catId: string,
  name: string,
): Promise<OwnerActionResult> {
  const owned = await requireOwnedCat(catId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }
  if (owned.cat.status === "BANNED") {
    return { ok: false, error: "banned" };
  }
  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: "invalid_name" };
  }
  // Slug is intentionally NOT regenerated (SEO stability).
  await prisma.cat.update({
    where: { id: catId },
    data: { name: parsed.data },
  });
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

export async function addCatImage(
  catId: string,
  r2Key: string,
): Promise<OwnerActionResult> {
  const owned = await requireOwnedCat(catId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }
  if (owned.cat.status === "BANNED") {
    return { ok: false, error: "banned" };
  }
  const imageId = ORIGINAL_KEY.exec(r2Key)?.[1];
  if (!imageId) {
    return { ok: false, error: "invalid_key" };
  }
  const existing = await prisma.catImage.findMany({
    where: { catId },
    select: { position: true },
  });
  if (existing.length >= MAX_IMAGES_PER_CAT) {
    return { ok: false, error: "image_limit" };
  }
  const position =
    existing.reduce((max, img) => Math.max(max, img.position), -1) + 1;
  const { width, height, status } = await ingestImage(imageId);
  await prisma.catImage.create({
    data: { id: imageId, catId, r2Key, width, height, position, status },
  });
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

export async function deleteCatImage(
  imageId: string,
): Promise<OwnerActionResult> {
  const image = await prisma.catImage.findUnique({
    where: { id: imageId },
    select: { id: true, catId: true },
  });
  if (!image) {
    return { ok: false, error: "not_found" };
  }
  const owned = await requireOwnedCat(image.catId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }
  if (owned.cat.status === "BANNED") {
    return { ok: false, error: "banned" };
  }
  const count = await prisma.catImage.count({ where: { catId: image.catId } });
  if (count <= 1) {
    return { ok: false, error: "last_image" };
  }
  await prisma.catImage.delete({ where: { id: imageId } });
  await deleteObjects(imageObjectKeys(imageId));
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

export async function deleteCatOwned(
  catId: string,
): Promise<OwnerActionResult> {
  const owned = await requireOwnedCat(catId);
  if (!owned.ok) {
    return { ok: false, error: owned.error };
  }
  // Deleting your own cat is allowed in any status, including BANNED.
  const images = await prisma.catImage.findMany({
    where: { catId },
    select: { id: true },
  });
  await prisma.cat.delete({ where: { id: catId } }); // cascades CatImage rows
  await deleteObjects(images.flatMap((img) => imageObjectKeys(img.id)));
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `npx vitest run src/cats/owner-actions.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Typecheck + lint, then commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/cats/owner-actions.ts src/cats/owner-actions.test.ts
git commit -m "feat(cats): owner server actions (rename, add/delete image, delete cat)"
```

---

### Task 5: Client upload helper + dashboard page & components

**Files:** Create `src/components/upload/upload-to-r2.ts`; Modify `src/components/upload/upload-form.tsx`; Create `src/app/dashboard/page.tsx`, `src/components/dashboard/cat-card.tsx`, `src/components/dashboard/rename-cat-form.tsx`, `src/components/dashboard/add-image.tsx`. (UI is functional/minimal — no styling pass.)

- [ ] **Step 1: Extract `src/components/upload/upload-to-r2.ts`**

```ts
type SignResponse = { uploadUrl: string; r2Key: string };

/** Sign an upload, PUT the original bytes straight to R2, return its r2Key. */
export async function uploadToR2(file: File): Promise<{ r2Key: string }> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  if (!signRes.ok) {
    throw new Error("Could not get upload URL");
  }
  const { uploadUrl, r2Key } = (await signRes.json()) as SignResponse;

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Upload failed");
  }
  return { r2Key };
}
```

- [ ] **Step 2: Modify `src/components/upload/upload-form.tsx` to use it**

Remove the local `SignResponse` type and the local `uploadOne` function; add `import { uploadToR2 } from "@/components/upload/upload-to-r2";` (correct import order); in `onSubmit` replace `values.files.map(uploadOne)` with `values.files.map(uploadToR2)`.

- [ ] **Step 3: Write `src/components/dashboard/rename-cat-form.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { renameCat } from "@/cats/owner-actions";

type RenameCatFormProps = {
  catId: string;
  currentName: string;
  disabled?: boolean;
};

export function RenameCatForm({
  catId,
  currentName,
  disabled,
}: RenameCatFormProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    if (name.trim() === currentName || saving) {
      return;
    }
    setSaving(true);
    const result = await renameCat(catId, name);
    setSaving(false);
    if (result.ok) {
      toast.success("Name updated");
      router.refresh();
    } else {
      toast.error(`Could not rename (${result.error})`);
      setName(currentName);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor={`name-${catId}`}>Cat name</label>
      <input
        id={`name-${catId}`}
        value={name}
        disabled={disabled || saving}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void save()}
      />
      <button type="submit" disabled={disabled || saving}>
        Save
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Write `src/components/dashboard/add-image.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addCatImage } from "@/cats/owner-actions";
import { ImageDropzone } from "@/components/upload/image-dropzone";
import { uploadToR2 } from "@/components/upload/upload-to-r2";

type AddImageProps = {
  catId: string;
  remaining: number;
  disabled?: boolean;
};

export function AddImage({ catId, remaining, disabled }: AddImageProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  if (remaining <= 0) {
    return <p>Max images reached.</p>;
  }

  async function submit(): Promise<void> {
    if (files.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      for (const file of files.slice(0, remaining)) {
        const { r2Key } = await uploadToR2(file);
        const result = await addCatImage(catId, r2Key);
        if (!result.ok) {
          throw new Error(result.error);
        }
      }
      toast.success("Image added (pending review)");
      setFiles([]);
      router.refresh();
    } catch (err) {
      toast.error(
        `Could not add image${err instanceof Error ? ` (${err.message})` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ImageDropzone files={files} onChange={setFiles} disabled={disabled || busy} />
      <button type="button" onClick={() => void submit()} disabled={disabled || busy}>
        {busy ? "Uploading…" : "Add image"}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/components/dashboard/cat-card.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteCatImage, deleteCatOwned } from "@/cats/owner-actions";
import { AddImage } from "@/components/dashboard/add-image";
import { RenameCatForm } from "@/components/dashboard/rename-cat-form";
import { MAX_IMAGES_PER_CAT } from "@/lib/constants";

export type CatCardImage = {
  id: string;
  thumbUrl: string;
  status: string;
};

export type CatCardData = {
  id: string;
  name: string;
  status: string;
  images: CatCardImage[];
};

export function CatCard({ cat }: { cat: CatCardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const banned = cat.status === "BANNED";
  const remaining = MAX_IMAGES_PER_CAT - cat.images.length;

  async function removeImage(imageId: string): Promise<void> {
    setBusy(true);
    const result = await deleteCatImage(imageId);
    setBusy(false);
    if (result.ok) {
      toast.success("Image removed");
      router.refresh();
    } else {
      toast.error(`Could not remove image (${result.error})`);
    }
  }

  async function removeCat(): Promise<void> {
    if (!window.confirm(`Delete "${cat.name}" and all its images?`)) {
      return;
    }
    setBusy(true);
    const result = await deleteCatOwned(cat.id);
    setBusy(false);
    if (result.ok) {
      toast.success("Cat deleted");
      router.refresh();
    } else {
      toast.error(`Could not delete cat (${result.error})`);
    }
  }

  return (
    <article aria-label={cat.name}>
      <header>
        <RenameCatForm catId={cat.id} currentName={cat.name} disabled={banned || busy} />
        <span>Status: {cat.status}</span>
      </header>

      <ul>
        {cat.images.map((image) => (
          <li key={image.id}>
            {/* biome-ignore lint/performance/noImgElement: R2/CDN thumbnail */}
            <img src={image.thumbUrl} alt={`${cat.name} (${image.status})`} width={120} />
            <span>{image.status}</span>
            <button
              type="button"
              onClick={() => void removeImage(image.id)}
              disabled={banned || busy}
            >
              Delete image
            </button>
          </li>
        ))}
      </ul>

      {!banned ? <AddImage catId={cat.id} remaining={remaining} disabled={busy} /> : null}

      <button type="button" onClick={() => void removeCat()} disabled={busy}>
        Delete cat
      </button>
    </article>
  );
}
```

- [ ] **Step 6: Write `src/app/dashboard/page.tsx`**

```tsx
import { requireUser } from "@/auth/guards";
import { CatCard } from "@/components/dashboard/cat-card";
import type { CatCardData } from "@/components/dashboard/cat-card";
import { prisma } from "@/lib/prisma";
import { MAX_CATS_PER_USER } from "@/lib/constants";
import { thumbUrl } from "@/storage/keys";

export default async function DashboardPage() {
  const session = await requireUser();

  const cats = await prisma.cat.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      images: {
        orderBy: { position: "asc" },
        select: { id: true, status: true },
      },
    },
  });

  const cards: CatCardData[] = cats.map((cat) => ({
    id: cat.id,
    name: cat.name,
    status: cat.status,
    images: cat.images.map((image) => ({
      id: image.id,
      status: image.status,
      thumbUrl: thumbUrl(image.id),
    })),
  }));

  const atLimit = cards.length >= MAX_CATS_PER_USER;

  return (
    <main>
      <h1>My cats</h1>
      {atLimit ? null : <a href="/upload">Add a cat</a>}
      {cards.length === 0 ? (
        <p>
          You have no cats yet. <a href="/upload">Upload your first cat</a>.
        </p>
      ) : (
        <section>
          {cards.map((cat) => (
            <CatCard key={cat.id} cat={cat} />
          ))}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck exit 0; lint clean except the pre-existing warning (the new `<img>` is biome-ignored). Run `npm run format` if Biome reorders imports.

- [ ] **Step 8: Commit**

```bash
git add src/components/upload/upload-to-r2.ts src/components/upload/upload-form.tsx src/app/dashboard src/components/dashboard
git commit -m "feat(dashboard): owner cabinet page, cat card, rename + image management"
```

---

### Task 6: "My cats" header link

**Files:** Modify `src/components/site-header.tsx`

- [ ] **Step 1: Read `src/components/site-header.tsx`**

Find where the signed-in branch renders (it currently shows the user email + Sign out when there's a session, and a "Sign in" link otherwise).

- [ ] **Step 2: Add a "My cats" link in the signed-in branch**

In the JSX shown only when a session exists, add (before the Sign out control, inside the existing `<nav>`):

```tsx
<a href="/dashboard">My cats</a>
```

Keep it consistent with the existing markup/anchors in that file (match how the other nav links are rendered). Do not restructure the header.

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck exit 0; lint clean except the pre-existing warning.

- [ ] **Step 4: Commit**

```bash
git add src/components/site-header.tsx
git commit -m "feat(dashboard): add My cats link to the site header"
```

---

### Task 7: Full verification

**Files:** none

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS — all suites green (previous 96 + new: r2 (3), ingest-image (2), owner-guard (3), owner-actions (13) = 117 total).

- [ ] **Step 2: Typecheck + lint (whole repo)**

Run: `npm run typecheck && npm run lint && npm run lint:css`
Expected: typecheck exit 0; Biome only the pre-existing `cat-image-carousel.tsx` warning; Stylelint clean.

- [ ] **Step 3: Manual smoke (dev)**

Run `npm run dev` (note the port — 3000 may be taken). With a signed-in session: visit `/dashboard` — own cats render; rename a cat (toast + persists); add an image (pending); delete an image (blocked on the last one); delete a cat (confirm). Header shows "My cats". (Images render only with a real `R2_PUBLIC_URL`/token; without it the flows still work, thumbnails 404 — expected.) Stop the dev server when done.

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git add -A && git commit -m "chore(dashboard): owner cabinet verification" || echo "nothing to commit"
```
