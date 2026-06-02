# Upload & Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Let authenticated users create a cat (name + 1..3 images) by uploading originals directly to R2 via presigned PUT, then server-side derive WebP thumb/card sizes with `sharp`, auto-screen each image for NSFW + "is-it-a-cat" via Cloudflare Workers AI (NSFWJS fallback), enforce per-user/per-cat caps, and give moderators/admins a `/admin` queue plus an anonymous report endpoint that auto-hides abused cats.

**Architecture:** Thin Next.js Route Handlers validate every external input with Zod at the boundary and delegate to single-responsibility modules in `src/storage` (R2 client, presign, sharp processing, key conventions) and `src/moderation` (Workers AI screen, NSFWJS fallback, reports, admin actions). Image bytes never transit Vercel — the browser PUTs the original straight to R2 and the server fetches each original back through the S3 client only to produce derivatives. Rating/pairing and DB writes use the canonical Prisma schema; pure modules stay DB-free and the glue (`Cat.status` promotion, caps, status transitions) lives in the moderation/storage modules and is unit-tested with the screen mocked.

**Tech Stack:** Next.js 15 App Router (Route Handlers, RSC for `/admin` + `/upload` shells), Prisma + Neon Postgres, Cloudflare R2 via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `sharp` for WebP/thumb/card + EXIF strip, Cloudflare Workers AI REST (`@cf/...` NSFW + image-classification models) with `nsfwjs` + `@tensorflow/tfjs-node` fallback, React Hook Form + `@hookform/resolvers/zod` + Zod v4, Auth.js v5 guards (`requireUser`/`requireModerator` from earlier phase), Vitest for unit tests.

---

## File Structure

Files created or modified by THIS plan. One responsibility per file. Kebab-case; named exports only
(except Next.js `route`/`page` files which use `default`).

| File | Responsibility |
|---|---|
| `src/lib/r2.ts` | R2 S3 client singleton + presigned PUT URL helper + key/public-URL helpers |
| `src/storage/keys.ts` | R2 key conventions: `originalKey`, `thumbKey`, `cardKey`, `publicUrl` derivation |
| `src/storage/upload-sign.ts` | Build a presigned PUT URL + the target `r2Key` for an original upload |
| `src/storage/process-image.ts` | `sharp`: read original from R2, strip EXIF, WebP, thumb(200)/card(800), write variants to R2 |
| `src/moderation/screen-image.ts` | Cloudflare Workers AI NSFW + is-it-a-cat → `ImageStatus` decision |
| `src/moderation/nsfw-fallback.ts` | NSFWJS fallback NSFW probability when Workers AI errors / is rate-limited |
| `src/moderation/reports.ts` | `createReport`: insert `Report`, auto-set `Cat.status = HIDDEN` past threshold |
| `src/moderation/admin-actions.ts` | approve / reject image; hide / delete / ban cat (calls prisma) |
| `src/app/api/upload/sign/route.ts` | `POST /api/upload/sign` — auth-gated presigned PUT URL after type/size validation |
| `src/app/api/cats/route.ts` | `POST /api/cats` — create cat, process + screen images, enforce caps, promote status |
| `src/app/api/report/route.ts` | `POST /api/report` — insert report, rate-limit, auto-hide |
| `src/components/upload/upload-form.tsx` | RHF + Zod create-cat form: name + 1..3 files; signs, uploads to R2, posts `/api/cats` |
| `src/components/upload/image-dropzone.tsx` | Client dropzone with object-URL previews (cleanup) for 1..MAX_IMAGES_PER_CAT files |
| `src/components/admin/moderation-queue.tsx` | Server component: PENDING images/cats queue with approve/reject/hide/delete/ban actions |
| `src/components/admin/report-queue.tsx` | Server component: reported (HIDDEN/most-reported) cats with admin actions |
| `src/app/upload/page.tsx` | `/upload` — auth-gated page rendering `UploadForm` |
| `src/app/admin/page.tsx` | `/admin` — admin-gated page rendering moderation + report queues |
| `src/lib/constants.ts` | (MODIFY) add `MAX_UPLOAD_BYTES`, `ALLOWED_UPLOAD_TYPES`, `REPORT_HIDE_THRESHOLD`, `NSFW_REJECT_THRESHOLD`, `CAT_MIN_CONFIDENCE`, `WEBP_QUALITY` |
| `src/storage/keys.test.ts` | Vitest: key derivation + public URL |
| `src/storage/upload-sign.test.ts` | Vitest: presign type/size validation + key shape (R2 client mocked) |
| `src/storage/process-image.test.ts` | Vitest: sharp produces 2 WebP variants, strips EXIF, writes both keys (R2 mocked) |
| `src/moderation/screen-image.test.ts` | Vitest: NSFW reject / low-cat-confidence pending / clean approve / fallback path (fetch + fallback mocked) |
| `src/moderation/reports.test.ts` | Vitest: insert report; auto-hide at threshold; 404 missing cat (prisma mocked) |
| `src/moderation/admin-actions.test.ts` | Vitest: approve promotes cat ACTIVE; reject; hide; delete; ban (prisma mocked) |
| `src/app/api/cats/route.test.ts` | Vitest: caps (409 MAX_CATS_PER_USER, 400 too many images), status transitions, 401 (deps mocked) |

Assumed already present from earlier phases (DO NOT recreate): `prisma/schema.prisma`, `src/lib/prisma.ts`,
`src/lib/env.ts`, `src/auth/guards.ts` (`requireUser`, `requireModerator`), `src/lib/slug.ts` (`slug`),
`src/lib/rate-limit.ts` (`check`), `src/org/join-by-code.ts` (`joinByCode`), `vitest.config.ts`, Biome config.

---

### Task 1: Constants and R2 client (`src/lib/r2.ts`)

**Files:**
- Modify: `src/lib/constants.ts`
- Create: `src/lib/r2.ts`

- [ ] **Step 1: Load skill infra-platform-cloudflare-workers and follow its best practices**
  Read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/infra-platform-cloudflare-workers/SKILL.md` and `examples/r2.md`. Key takeaways applied here: we are calling R2 over the **S3-compatible HTTP API from the Next.js server** (not from inside a Worker), so we use `@aws-sdk/client-s3` against the R2 S3 endpoint with credentials from `env`; never hand-roll auth; never buffer giant payloads when streaming is enough. Also re-read CLAUDE.md conventions (kebab-case, named exports, `import type`, named constants, no magic numbers).

- [ ] **Step 2: Add upload/moderation constants to `src/lib/constants.ts`**
  Append the following to the EXISTING `src/lib/constants.ts` (which already holds `MAX_CATS_PER_USER`, `MAX_IMAGES_PER_CAT`, `MAX_ORGS_PER_USER`, `MAX_ORGS_PER_CAT`, `GLICKO_DEFAULT`, `SCORE`, `IMAGE_SIZE` per the contracts). Do not duplicate existing exports.

  ```ts
  // ── Upload limits ──────────────────────────────────────────────
  export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per original

  export const ALLOWED_UPLOAD_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ] as const;
  export type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

  // ── Moderation thresholds (configurable defaults; tune on data) ──
  export const REPORT_HIDE_THRESHOLD = 5; // distinct reports → auto-hide cat
  export const NSFW_REJECT_THRESHOLD = 0.85; // P(nsfw) ≥ → REJECTED
  export const NSFW_PENDING_THRESHOLD = 0.5; // P(nsfw) ≥ (but < reject) → PENDING
  export const CAT_MIN_CONFIDENCE = 0.4; // P(is-a-cat) ≥ → eligible for APPROVED

  // ── Image encoding ───────────────────────────────────────────────
  export const WEBP_QUALITY = 82; // sharp .webp({ quality })

  // Presigned PUT URL lifetime — keep short (skill: < 1h)
  export const PRESIGN_TTL_SECONDS = 300; // 5 min
  ```

- [ ] **Step 3: Write the R2 client + helpers in `src/lib/r2.ts`**
  Full code below. `env` is the validated env object from `src/lib/env.ts` (assumed exporting `env` with the R2 vars). The presign helper takes an explicit content type and returns a time-limited PUT URL.

  ```ts
  import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

  import { PRESIGN_TTL_SECONDS } from "@/lib/constants";
  import { env } from "@/lib/env";

  /** Single S3 client pointed at the Cloudflare R2 S3 endpoint. */
  export const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  /** Presigned PUT URL for uploading an object's bytes directly from the browser. */
  export async function presignPut(
    key: string,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(r2, command, { expiresIn: PRESIGN_TTL_SECONDS });
  }

  /** Public CDN URL for an object key (browser fetches images directly from R2/CDN). */
  export function publicUrl(key: string): string {
    return `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  ```

- [ ] **Step 4: Install the S3 SDK dependencies**
  Run exactly:
  ```bash
  npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  ```
  Expected: packages added to `dependencies`, no peer-dep errors. If `sharp` and `nsfwjs` are not yet present they are installed in Tasks 3 and 5 respectively.

- [ ] **Step 5: Typecheck the new files**
  Run:
  ```bash
  npm run typecheck
  ```
  Expected: PASS (exit 0), no errors referencing `src/lib/r2.ts` or `src/lib/constants.ts`.

- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/r2.ts src/lib/constants.ts package.json package-lock.json
  git commit -m "feat(storage): add R2 S3 client, presign helper, and upload/moderation constants"
  ```

---

### Task 2: R2 key conventions (`src/storage/keys.ts`)

**Files:**
- Create: `src/storage/keys.ts`
- Test: `src/storage/keys.test.ts`

- [ ] **Step 1: Load skill web-files-file-upload-patterns and follow its best practices**
  Read `.claude/skills/web-files-file-upload-patterns/SKILL.md` (Pattern 5 presigned URLs, RED FLAGS on sanitizing keys server-side). Takeaway applied: clients only ever upload to the `original` key we mint; derived keys are computed by convention, never accepted from the client.

- [ ] **Step 2: Write the failing test `src/storage/keys.test.ts`**
  Full code:

  ```ts
  import { describe, expect, it } from "vitest";

  import { cardKey, originalKey, thumbKey } from "./keys";

  const IMAGE_ID = "img_abc123";
  const ORIGINAL = `cats/${IMAGE_ID}/original`;

  describe("r2 keys", () => {
    it("derives the original key from an image id", () => {
      expect(originalKey(IMAGE_ID)).toBe(ORIGINAL);
    });

    it("derives thumb and card keys with the .webp extension", () => {
      expect(thumbKey(IMAGE_ID)).toBe(`cats/${IMAGE_ID}/thumb.webp`);
      expect(cardKey(IMAGE_ID)).toBe(`cats/${IMAGE_ID}/card.webp`);
    });
  });
  ```

- [ ] **Step 3: Run the test, expect FAIL**
  ```bash
  npx vitest run src/storage/keys.test.ts
  ```
  Expected: FAIL — `Cannot find module './keys'` (the implementation does not exist yet).

- [ ] **Step 4: Write the implementation `src/storage/keys.ts`**
  Full code:

  ```ts
  import { publicUrl } from "@/lib/r2";

  /** All objects for one CatImage live under `cats/<imageId>/`. */
  export function originalKey(imageId: string): string {
    return `cats/${imageId}/original`;
  }

  export function thumbKey(imageId: string): string {
    return `cats/${imageId}/thumb.webp`;
  }

  export function cardKey(imageId: string): string {
    return `cats/${imageId}/card.webp`;
  }

  /** Public CDN URL for a derived variant. */
  export function thumbUrl(imageId: string): string {
    return publicUrl(thumbKey(imageId));
  }

  export function cardUrl(imageId: string): string {
    return publicUrl(cardKey(imageId));
  }
  ```

- [ ] **Step 5: Run the test, expect PASS**
  ```bash
  npx vitest run src/storage/keys.test.ts
  ```
  Expected: PASS — 2 tests passing.

- [ ] **Step 6: Commit**
  ```bash
  git add src/storage/keys.ts src/storage/keys.test.ts
  git commit -m "feat(storage): r2 key conventions for original/thumb/card variants"
  ```

---

### Task 3: Presign builder (`src/storage/upload-sign.ts`) and the sign route

**Files:**
- Create: `src/storage/upload-sign.ts`
- Test: `src/storage/upload-sign.test.ts`
- Create: `src/app/api/upload/sign/route.ts`

- [ ] **Step 1: Load skills web-files-file-upload-patterns and web-forms-zod-validation and follow their best practices**
  Re-read upload-patterns Pattern 5 (server mints presigned URL, never proxies bytes; sanitize keys server-side) and zod-validation Patterns 1-2 (named constants, `safeParse`, derive types). Boundary validation lives in the route; the builder is pure-ish glue over `lib/r2`.

- [ ] **Step 2: Write the failing test `src/storage/upload-sign.test.ts`**
  We mock `@/lib/r2`'s `presignPut`. Full code:

  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("@/lib/r2", () => ({
    presignPut: vi.fn(async () => "https://r2.example/presigned-put"),
  }));

  import { presignPut } from "@/lib/r2";
  import { buildUploadSign } from "./upload-sign";

  const CONTENT_TYPE = "image/jpeg";

  describe("buildUploadSign", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns an uploadUrl and an original r2Key under cats/<id>/original", async () => {
      const result = await buildUploadSign(CONTENT_TYPE);
      expect(result.uploadUrl).toBe("https://r2.example/presigned-put");
      expect(result.r2Key).toMatch(/^cats\/[^/]+\/original$/);
      expect(presignPut).toHaveBeenCalledWith(result.r2Key, CONTENT_TYPE);
    });

    it("mints a unique key per call", async () => {
      const a = await buildUploadSign(CONTENT_TYPE);
      const b = await buildUploadSign(CONTENT_TYPE);
      expect(a.r2Key).not.toBe(b.r2Key);
    });
  });
  ```

- [ ] **Step 3: Run the test, expect FAIL**
  ```bash
  npx vitest run src/storage/upload-sign.test.ts
  ```
  Expected: FAIL — `Cannot find module './upload-sign'`.

- [ ] **Step 4: Write the implementation `src/storage/upload-sign.ts`**
  `cuid` is already a project dependency (Prisma uses it); use `@paralleldrive/cuid2` `createId` which is the maintained successor. If not yet installed, install it: `npm i @paralleldrive/cuid2`. Full code:

  ```ts
  import { createId } from "@paralleldrive/cuid2";

  import { presignPut } from "@/lib/r2";
  import { originalKey } from "@/storage/keys";

  export type UploadSign = {
    uploadUrl: string;
    r2Key: string;
  };

  /**
   * Mint a fresh CatImage id, build its `original` r2Key, and return a presigned
   * PUT URL the browser uses to upload the original bytes directly to R2.
   * The same id is later reused so derived variants land under cats/<id>/.
   */
  export async function buildUploadSign(
    contentType: string,
  ): Promise<UploadSign> {
    const imageId = createId();
    const r2Key = originalKey(imageId);
    const uploadUrl = await presignPut(r2Key, contentType);
    return { uploadUrl, r2Key };
  }
  ```

- [ ] **Step 5: Run the test, expect PASS**
  ```bash
  npx vitest run src/storage/upload-sign.test.ts
  ```
  Expected: PASS — 2 tests passing.

- [ ] **Step 6: Write the sign route `src/app/api/upload/sign/route.ts`**
  Auth-gated; validates content type against `ALLOWED_UPLOAD_TYPES` and size against `MAX_UPLOAD_BYTES`. Full code matching the contract (`{ contentType, size }` → `{ uploadUrl, r2Key }`, errors `400/401/500`):

  ```ts
  import { NextResponse } from "next/server";
  import { z } from "zod";

  import { requireUser } from "@/auth/guards";
  import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
  import { buildUploadSign } from "@/storage/upload-sign";

  const BodySchema = z.object({
    contentType: z.enum(ALLOWED_UPLOAD_TYPES),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  });

  export async function POST(request: Request): Promise<Response> {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid content type or size" },
        { status: 400 },
      );
    }

    try {
      const { uploadUrl, r2Key } = await buildUploadSign(
        parsed.data.contentType,
      );
      return NextResponse.json({ uploadUrl, r2Key }, { status: 200 });
    } catch {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
  ```

- [ ] **Step 7: Typecheck**
  ```bash
  npm run typecheck
  ```
  Expected: PASS (exit 0).

- [ ] **Step 8: Commit**
  ```bash
  git add src/storage/upload-sign.ts src/storage/upload-sign.test.ts src/app/api/upload/sign/route.ts package.json package-lock.json
  git commit -m "feat(upload): presign builder and POST /api/upload/sign route"
  ```

---

### Task 4: Server-side image processing with `sharp` (`src/storage/process-image.ts`)

**Files:**
- Create: `src/storage/process-image.ts`
- Test: `src/storage/process-image.test.ts`

- [ ] **Step 1: Load skill web-files-image-handling and follow its best practices**
  Read `.claude/skills/web-files-image-handling/SKILL.md` (Pattern 5 format conversion, EXIF). Server context note from the skill: **Node has no auto-rotate**, so we use `sharp().rotate()` to bake in EXIF orientation, then `.withMetadata(false)` (sharp strips metadata by default on output) so the stored WebP carries no EXIF. `sharp` resizes with `fit: "inside"` (longest edge cap) preserving aspect ratio.

- [ ] **Step 2: Install `sharp`**
  ```bash
  npm i sharp
  ```
  Expected: `sharp` added to `dependencies` (it ships prebuilt binaries for the platform).

- [ ] **Step 3: Write the failing test `src/storage/process-image.test.ts`**
  We mock `@/lib/r2` (`r2` client) to capture `PutObjectCommand` sends and to return a tiny real PNG buffer for the original `GetObjectCommand`. We use a real 1x1 PNG so `sharp` actually runs. Full code:

  ```ts
  import { Buffer } from "node:buffer";

  import { beforeEach, describe, expect, it, vi } from "vitest";

  // A real 2x2 PNG so sharp can decode/resize it.
  const PNG_2X2 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNkYGD4z8DAwMgAAwAQAAH/Lh3xAAAAAElFTkSuQmCC",
    "base64",
  );

  const sent: Array<{ Key?: string; ContentType?: string; size: number }> = [];

  vi.mock("@aws-sdk/client-s3", () => {
    class GetObjectCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    }
    class PutObjectCommand {
      input: { Key?: string; ContentType?: string; Body?: Buffer };
      constructor(input: { Key?: string; ContentType?: string; Body?: Buffer }) {
        this.input = input;
      }
    }
    return { GetObjectCommand, PutObjectCommand, S3Client: class {} };
  });

  vi.mock("@/lib/r2", () => ({
    r2: {
      send: vi.fn(async (command: { input: Record<string, unknown> }) => {
        const ctor = command.constructor.name;
        if (ctor === "GetObjectCommand") {
          return {
            Body: {
              transformToByteArray: async () => new Uint8Array(PNG_2X2),
            },
          };
        }
        // PutObjectCommand
        const body = command.input.Body as Buffer;
        sent.push({
          Key: command.input.Key as string,
          ContentType: command.input.ContentType as string,
          size: body.byteLength,
        });
        return {};
      }),
    },
  }));

  import { processImage } from "./process-image";

  const IMAGE_ID = "img_test";

  describe("processImage", () => {
    beforeEach(() => {
      sent.length = 0;
    });

    it("writes thumb and card WebP variants and returns dimensions", async () => {
      const result = await processImage(IMAGE_ID);

      const keys = sent.map((s) => s.Key);
      expect(keys).toContain(`cats/${IMAGE_ID}/thumb.webp`);
      expect(keys).toContain(`cats/${IMAGE_ID}/card.webp`);
      expect(sent.every((s) => s.ContentType === "image/webp")).toBe(true);
      expect(sent.every((s) => s.size > 0)).toBe(true);

      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
    });
  });
  ```

- [ ] **Step 4: Run the test, expect FAIL**
  ```bash
  npx vitest run src/storage/process-image.test.ts
  ```
  Expected: FAIL — `Cannot find module './process-image'`.

- [ ] **Step 5: Write the implementation `src/storage/process-image.ts`**
  Reads the original from R2, decodes once, baking EXIF rotation; produces WebP thumb (200) and card (800); writes both; returns the **original** intrinsic dimensions (post-rotate) used for `CatImage.width/height` and for downstream NSFW screening (which reuses the decoded buffer). Full code:

  ```ts
  import { Buffer } from "node:buffer";

  import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
  import sharp from "sharp";

  import { IMAGE_SIZE, WEBP_QUALITY } from "@/lib/constants";
  import { env } from "@/lib/env";
  import { r2 } from "@/lib/r2";
  import { cardKey, originalKey, thumbKey } from "@/storage/keys";

  export type ProcessedImage = {
    width: number; // intrinsic width of the (rotation-baked) original
    height: number;
    /** The decoded, EXIF-stripped original WebP buffer — reused by the NSFW screen. */
    screenBuffer: Buffer;
  };

  async function getOriginal(imageId: string): Promise<Buffer> {
    const res = await r2.send(
      new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: originalKey(imageId) }),
    );
    const body = res.Body as { transformToByteArray: () => Promise<Uint8Array> };
    return Buffer.from(await body.transformToByteArray());
  }

  async function putWebp(key: string, body: Buffer): Promise<void> {
    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: "image/webp",
      }),
    );
  }

  /**
   * Fetch the original from R2, bake EXIF rotation, strip metadata, and write
   * WebP thumb (200) and card (800) variants back to R2. Returns intrinsic
   * dimensions plus a decoded WebP buffer reused for NSFW screening.
   */
  export async function processImage(imageId: string): Promise<ProcessedImage> {
    const original = await getOriginal(imageId);

    // Decode once, bake orientation (Node sharp does not auto-rotate on read).
    const base = sharp(original).rotate();
    const meta = await base.metadata();

    const thumb = await sharp(original)
      .rotate()
      .resize(IMAGE_SIZE.THUMB, IMAGE_SIZE.THUMB, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const card = await sharp(original)
      .rotate()
      .resize(IMAGE_SIZE.CARD, IMAGE_SIZE.CARD, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    await putWebp(thumbKey(imageId), thumb);
    await putWebp(cardKey(imageId), card);

    // sharp output strips metadata by default → EXIF removed in card.
    const screenBuffer = card;

    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      screenBuffer,
    };
  }
  ```

- [ ] **Step 6: Run the test, expect PASS**
  ```bash
  npx vitest run src/storage/process-image.test.ts
  ```
  Expected: PASS — 1 test passing; both `thumb.webp` and `card.webp` keys captured, dimensions `2x2`.

- [ ] **Step 7: Commit**
  ```bash
  git add src/storage/process-image.ts src/storage/process-image.test.ts package.json package-lock.json
  git commit -m "feat(storage): sharp WebP thumb/card processing with EXIF strip"
  ```

---

### Task 5: NSFWJS fallback (`src/moderation/nsfw-fallback.ts`)

**Files:**
- Create: `src/moderation/nsfw-fallback.ts`

- [ ] **Step 1: Load skill infra-platform-cloudflare-workers and follow its best practices**
  (Same skill governs the Workers-AI area; the fallback is the offline path when Workers AI errors or rate-limits.) Confirm from the skill that Workers AI usage from outside a Worker is the REST inference endpoint — therefore a local fallback model is the right resilience strategy. Re-read CLAUDE.md: NSFWJS is the documented free fallback.

- [ ] **Step 2: Install fallback deps**
  ```bash
  npm i nsfwjs @tensorflow/tfjs-node
  ```
  Expected: both added to `dependencies`. `@tensorflow/tfjs-node` provides the Node backend NSFWJS needs.

- [ ] **Step 3: Write the implementation `src/moderation/nsfw-fallback.ts`**
  Loads the model lazily and caches the loaded model in a module-level promise (acceptable here: a Next.js server process, not a Workers isolate — the cached value is immutable model weights, not request state). Returns `P(nsfw)` as the max of the unsafe classes. Full code:

  ```ts
  import { Buffer } from "node:buffer";

  import * as tf from "@tensorflow/tfjs-node";
  import * as nsfwjs from "nsfwjs";

  // Cache the loaded model (immutable weights — safe to memoize per process).
  let modelPromise: Promise<nsfwjs.NSFWJS> | null = null;

  function loadModel(): Promise<nsfwjs.NSFWJS> {
    modelPromise ??= nsfwjs.load();
    return modelPromise;
  }

  const UNSAFE_CLASSES = new Set(["Porn", "Hentai", "Sexy"]);

  /**
   * Local NSFWJS classification fallback. Returns the probability that the
   * image is unsafe (max of the unsafe class scores), in [0, 1].
   */
  export async function nsfwFallbackScore(image: Buffer): Promise<number> {
    const model = await loadModel();
    const decoded = tf.node.decodeImage(image, 3) as tf.Tensor3D;
    try {
      const predictions = await model.classify(decoded);
      let unsafe = 0;
      for (const p of predictions) {
        if (UNSAFE_CLASSES.has(p.className) && p.probability > unsafe) {
          unsafe = p.probability;
        }
      }
      return unsafe;
    } finally {
      decoded.dispose();
    }
  }
  ```

- [ ] **Step 4: Typecheck**
  ```bash
  npm run typecheck
  ```
  Expected: PASS (exit 0). (No unit test here — it is exercised via the mocked fallback path in Task 6's `screen-image.test.ts`; running the real TF model in unit tests is out of scope.)

- [ ] **Step 5: Commit**
  ```bash
  git add src/moderation/nsfw-fallback.ts package.json package-lock.json
  git commit -m "feat(moderation): NSFWJS local fallback scorer"
  ```

---

### Task 6: Workers AI image screen (`src/moderation/screen-image.ts`)

**Files:**
- Create: `src/moderation/screen-image.ts`
- Test: `src/moderation/screen-image.test.ts`

- [ ] **Step 1: Load skill infra-platform-cloudflare-workers and follow its best practices**
  (Already loaded in Task 5; re-confirm the Workers AI REST shape.) From outside a Worker, Workers AI inference is called via REST:
  `POST https://api.cloudflare.com/client/v4/accounts/<CLOUDFLARE_ACCOUNT_ID>/ai/run/<model>` with `Authorization: Bearer <CLOUDFLARE_API_TOKEN>` and a binary image body. We use the NSFW image classifier and an image-classification model for "is-it-a-cat". On any non-OK response or thrown error we fall back to NSFWJS (and treat cat-confidence as unknown → PENDING).

- [ ] **Step 2: Write the failing test `src/moderation/screen-image.test.ts`**
  Mock global `fetch` and the NSFWJS fallback module. Full code covering: clean+cat → `APPROVED`; high NSFW → `REJECTED`; borderline NSFW → `PENDING`; low cat-confidence → `PENDING`; fetch error → fallback path. Full code:

  ```ts
  import { Buffer } from "node:buffer";

  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("./nsfw-fallback", () => ({
    nsfwFallbackScore: vi.fn(async () => 0.1),
  }));

  import { nsfwFallbackScore } from "./nsfw-fallback";
  import { screenImage } from "./screen-image";

  const BUF = Buffer.from([0x01, 0x02, 0x03]);

  function aiResponse(body: unknown): Response {
    return new Response(JSON.stringify({ success: true, result: body }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  describe("screenImage", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("APPROVED when not nsfw and confidently a cat", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
        const u = String(url);
        if (u.includes("nsfw")) {
          return Promise.resolve(aiResponse([{ label: "nsfw", score: 0.02 }]));
        }
        return Promise.resolve(
          aiResponse([{ label: "tabby cat", score: 0.9 }]),
        );
      });
      expect(await screenImage(BUF)).toBe("APPROVED");
    });

    it("REJECTED when nsfw score is above the reject threshold", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
        const u = String(url);
        if (u.includes("nsfw")) {
          return Promise.resolve(aiResponse([{ label: "nsfw", score: 0.97 }]));
        }
        return Promise.resolve(aiResponse([{ label: "cat", score: 0.9 }]));
      });
      expect(await screenImage(BUF)).toBe("REJECTED");
    });

    it("PENDING when nsfw score is borderline", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
        const u = String(url);
        if (u.includes("nsfw")) {
          return Promise.resolve(aiResponse([{ label: "nsfw", score: 0.6 }]));
        }
        return Promise.resolve(aiResponse([{ label: "cat", score: 0.9 }]));
      });
      expect(await screenImage(BUF)).toBe("PENDING");
    });

    it("PENDING when cat confidence is low (clean but maybe not a cat)", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
        const u = String(url);
        if (u.includes("nsfw")) {
          return Promise.resolve(aiResponse([{ label: "nsfw", score: 0.02 }]));
        }
        return Promise.resolve(aiResponse([{ label: "toaster", score: 0.95 }]));
      });
      expect(await screenImage(BUF)).toBe("PENDING");
    });

    it("falls back to NSFWJS and returns PENDING when Workers AI errors", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("rate limited", { status: 429 }),
      );
      vi.mocked(nsfwFallbackScore).mockResolvedValueOnce(0.05);
      // clean per fallback, cat-confidence unknown → PENDING
      expect(await screenImage(BUF)).toBe("PENDING");
      expect(nsfwFallbackScore).toHaveBeenCalledOnce();
    });

    it("falls back and REJECTS when NSFWJS says unsafe", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("rate limited", { status: 429 }),
      );
      vi.mocked(nsfwFallbackScore).mockResolvedValueOnce(0.95);
      expect(await screenImage(BUF)).toBe("REJECTED");
    });
  });
  ```

- [ ] **Step 3: Run the test, expect FAIL**
  ```bash
  npx vitest run src/moderation/screen-image.test.ts
  ```
  Expected: FAIL — `Cannot find module './screen-image'`.

- [ ] **Step 4: Write the implementation `src/moderation/screen-image.ts`**
  Full code. The decision matrix: `nsfw ≥ NSFW_REJECT_THRESHOLD → REJECTED`; else `nsfw ≥ NSFW_PENDING_THRESHOLD → PENDING`; else clean → if `catConfidence ≥ CAT_MIN_CONFIDENCE → APPROVED` else `PENDING`. On Workers-AI failure: use NSFWJS for the NSFW signal and treat cat-confidence as unknown (`null`) → never auto-`APPROVED`.

  ```ts
  import type { Buffer } from "node:buffer";

  import {
    CAT_MIN_CONFIDENCE,
    NSFW_PENDING_THRESHOLD,
    NSFW_REJECT_THRESHOLD,
  } from "@/lib/constants";
  import { env } from "@/lib/env";
  import { nsfwFallbackScore } from "@/moderation/nsfw-fallback";

  import type { ImageStatus } from "@prisma/client";

  const NSFW_MODEL = "@cf/falcons-ai/nsfw_image_detection";
  const CLASSIFY_MODEL = "@cf/microsoft/resnet-50";

  type AiLabel = { label: string; score: number };

  function runUrl(model: string): string {
    return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;
  }

  async function runModel(model: string, image: Buffer): Promise<AiLabel[]> {
    const res = await fetch(runUrl(model), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(image),
    });
    if (!res.ok) {
      throw new Error(`Workers AI ${model} failed: ${res.status}`);
    }
    const json = (await res.json()) as { result: AiLabel[] };
    return json.result;
  }

  function nsfwScore(labels: AiLabel[]): number {
    const nsfw = labels.find((l) => l.label.toLowerCase() === "nsfw");
    return nsfw?.score ?? 0;
  }

  const CAT_LABELS = ["cat", "tabby", "tiger cat", "egyptian cat", "kitten"];

  function catConfidence(labels: AiLabel[]): number {
    let best = 0;
    for (const l of labels) {
      const name = l.label.toLowerCase();
      if (CAT_LABELS.some((c) => name.includes(c)) && l.score > best) {
        best = l.score;
      }
    }
    return best;
  }

  function decide(nsfw: number, catConf: number | null): ImageStatus {
    if (nsfw >= NSFW_REJECT_THRESHOLD) return "REJECTED";
    if (nsfw >= NSFW_PENDING_THRESHOLD) return "PENDING";
    if (catConf !== null && catConf >= CAT_MIN_CONFIDENCE) return "APPROVED";
    return "PENDING";
  }

  /**
   * Auto-screen one image. Tries Cloudflare Workers AI (NSFW + classification);
   * on any failure falls back to local NSFWJS for the NSFW signal and treats
   * cat-confidence as unknown (never auto-approves on the fallback path).
   */
  export async function screenImage(image: Buffer): Promise<ImageStatus> {
    try {
      const [nsfwLabels, classifyLabels] = await Promise.all([
        runModel(NSFW_MODEL, image),
        runModel(CLASSIFY_MODEL, image),
      ]);
      return decide(nsfwScore(nsfwLabels), catConfidence(classifyLabels));
    } catch {
      const nsfw = await nsfwFallbackScore(image);
      return decide(nsfw, null);
    }
  }
  ```

- [ ] **Step 5: Run the test, expect PASS**
  ```bash
  npx vitest run src/moderation/screen-image.test.ts
  ```
  Expected: PASS — 6 tests passing.

- [ ] **Step 6: Commit**
  ```bash
  git add src/moderation/screen-image.ts src/moderation/screen-image.test.ts
  git commit -m "feat(moderation): Workers AI NSFW + is-it-a-cat screen with NSFWJS fallback"
  ```

---

### Task 7: Create-cat orchestration route (`POST /api/cats`)

**Files:**
- Create: `src/app/api/cats/route.ts`
- Test: `src/app/api/cats/route.test.ts`

- [ ] **Step 1: Load skills api-database-prisma and web-forms-zod-validation and follow their best practices**
  Re-read prisma Pattern 5 (interactive transactions — use `tx`, keep short; but heavy image work happens BEFORE the transaction so we never hold a connection across sharp/AI calls) and zod Patterns 1-2. Plan: validate body → enforce caps → for each image `processImage` then `screenImage` (outside any tx) → create `Cat` + `CatImage[]` in one nested write → promote `Cat.status` to `ACTIVE` if any image is `APPROVED` → optional `joinByCode`.

- [ ] **Step 2: Write the failing test `src/app/api/cats/route.test.ts`**
  Mock `@/auth/guards`, `@/lib/prisma`, `@/storage/process-image`, `@/moderation/screen-image`, `@/lib/slug`, `@/org/join-by-code`. Full code:

  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("@/auth/guards", () => ({ requireUser: vi.fn() }));
  vi.mock("@/lib/slug", () => ({ slug: vi.fn(() => "fluffy-abc123") }));
  vi.mock("@/storage/process-image", () => ({
    processImage: vi.fn(async () => ({
      width: 800,
      height: 600,
      screenBuffer: Buffer.from([1]),
    })),
  }));
  vi.mock("@/moderation/screen-image", () => ({
    screenImage: vi.fn(async () => "APPROVED"),
  }));
  vi.mock("@/org/join-by-code", () => ({ joinByCode: vi.fn() }));
  vi.mock("@/lib/prisma", () => ({
    prisma: {
      cat: { count: vi.fn(), create: vi.fn(), update: vi.fn() },
    },
  }));

  import { requireUser } from "@/auth/guards";
  import { prisma } from "@/lib/prisma";
  import { screenImage } from "@/moderation/screen-image";
  import { POST } from "./route";

  const USER = { id: "user_1", role: "user" };

  function req(body: unknown): Request {
    return new Request("http://localhost/api/cats", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  describe("POST /api/cats", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(requireUser).mockResolvedValue(USER);
      vi.mocked(prisma.cat.count).mockResolvedValue(0);
      vi.mocked(prisma.cat.create).mockResolvedValue({
        id: "cat_1",
        slug: "fluffy-abc123",
        status: "PENDING",
      });
      vi.mocked(prisma.cat.update).mockResolvedValue({
        id: "cat_1",
        slug: "fluffy-abc123",
        status: "ACTIVE",
      });
    });

    it("returns 401 when not authenticated", async () => {
      vi.mocked(requireUser).mockResolvedValueOnce(null);
      const res = await POST(
        req({ name: "Fluffy", images: [{ r2Key: "cats/x/original" }] }),
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 when there are too many images", async () => {
      const res = await POST(
        req({
          name: "Fluffy",
          images: [
            { r2Key: "cats/a/original" },
            { r2Key: "cats/b/original" },
            { r2Key: "cats/c/original" },
            { r2Key: "cats/d/original" },
          ],
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 409 when the user is at the cat limit", async () => {
      vi.mocked(prisma.cat.count).mockResolvedValueOnce(2);
      const res = await POST(
        req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }),
      );
      expect(res.status).toBe(409);
    });

    it("creates a cat and promotes it to ACTIVE when an image is APPROVED", async () => {
      const res = await POST(
        req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }),
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toEqual({
        id: "cat_1",
        slug: "fluffy-abc123",
        status: "ACTIVE",
      });
      expect(prisma.cat.update).toHaveBeenCalled();
    });

    it("stays PENDING when no image is APPROVED", async () => {
      vi.mocked(screenImage).mockResolvedValue("PENDING");
      const res = await POST(
        req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }),
      );
      const json = await res.json();
      expect(json.status).toBe("PENDING");
      expect(prisma.cat.update).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 3: Run the test, expect FAIL**
  ```bash
  npx vitest run src/app/api/cats/route.test.ts
  ```
  Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 4: Write the implementation `src/app/api/cats/route.ts`**
  Note: the `r2Key` minted by `/api/upload/sign` has shape `cats/<imageId>/original`; we derive the `CatImage.id` from that key so `processImage`/`screenImage`/key derivation all line up. Full code matching the contract (`{ name, images, joinCode? }` → 201 `{ id, slug, status }`; errors `400/401/409/422/500`):

  ```ts
  import { NextResponse } from "next/server";
  import { z } from "zod";

  import { requireUser } from "@/auth/guards";
  import { MAX_CATS_PER_USER, MAX_IMAGES_PER_CAT } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";
  import { slug } from "@/lib/slug";
  import { screenImage } from "@/moderation/screen-image";
  import { joinByCode } from "@/org/join-by-code";
  import { processImage } from "@/storage/process-image";

  import type { ImageStatus } from "@prisma/client";

  const MIN_NAME = 1;
  const MAX_NAME = 60;
  const ORIGINAL_KEY = /^cats\/([^/]+)\/original$/;

  const BodySchema = z.object({
    name: z.string().trim().min(MIN_NAME).max(MAX_NAME),
    images: z
      .array(z.object({ r2Key: z.string().regex(ORIGINAL_KEY) }))
      .min(1)
      .max(MAX_IMAGES_PER_CAT),
    joinCode: z.string().optional(),
  });

  function imageIdFromKey(r2Key: string): string {
    const match = r2Key.match(ORIGINAL_KEY);
    if (!match) throw new Error("bad key");
    return match[1];
  }

  export async function POST(request: Request): Promise<Response> {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body or too many images" },
        { status: 400 },
      );
    }
    const { name, images, joinCode } = parsed.data;

    const owned = await prisma.cat.count({ where: { ownerId: user.id } });
    if (owned >= MAX_CATS_PER_USER) {
      return NextResponse.json(
        { error: "Cat limit reached" },
        { status: 409 },
      );
    }

    try {
      // Process + screen each image OUTSIDE any DB transaction (heavy I/O).
      const processed = await Promise.all(
        images.map(async (img, index) => {
          const id = imageIdFromKey(img.r2Key);
          const { width, height, screenBuffer } = await processImage(id);
          const status: ImageStatus = await screenImage(screenBuffer);
          return { id, r2Key: img.r2Key, width, height, position: index, status };
        }),
      );

      const created = await prisma.cat.create({
        data: {
          name,
          slug: slug(name),
          ownerId: user.id,
          status: "PENDING",
          images: {
            create: processed.map((p) => ({
              id: p.id,
              r2Key: p.r2Key,
              width: p.width,
              height: p.height,
              position: p.position,
              status: p.status,
            })),
          },
        },
        select: { id: true, slug: true, status: true },
      });

      const hasApproved = processed.some((p) => p.status === "APPROVED");
      let status = created.status;
      if (hasApproved) {
        const promoted = await prisma.cat.update({
          where: { id: created.id },
          data: { status: "ACTIVE", approvedAt: new Date() },
          select: { status: true },
        });
        status = promoted.status;
      }

      if (joinCode) {
        const joined = await joinByCode({ catId: created.id, joinCode });
        if (!joined.ok) {
          return NextResponse.json(
            { error: "Invalid join code" },
            { status: 422 },
          );
        }
      }

      return NextResponse.json(
        { id: created.id, slug: created.slug, status },
        { status: 201 },
      );
    } catch {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
  ```

- [ ] **Step 5: Run the test, expect PASS**
  ```bash
  npx vitest run src/app/api/cats/route.test.ts
  ```
  Expected: PASS — 5 tests passing.

- [ ] **Step 6: Typecheck**
  ```bash
  npm run typecheck
  ```
  Expected: PASS. (If `joinByCode`'s actual signature from the org phase differs, adjust the call site to match its exported signature — it must accept `{ catId, joinCode }` and return `{ ok: boolean }`; if the org phase exposes a different shape, align this call without changing the org module.)

- [ ] **Step 7: Commit**
  ```bash
  git add src/app/api/cats/route.ts src/app/api/cats/route.test.ts
  git commit -m "feat(cats): POST /api/cats orchestrates processing, screening, caps, status promotion"
  ```

---

### Task 8: Reports module + route (`POST /api/report`)

**Files:**
- Create: `src/moderation/reports.ts`
- Test: `src/moderation/reports.test.ts`
- Create: `src/app/api/report/route.ts`

- [ ] **Step 1: Load skills api-database-prisma and web-forms-zod-validation and follow their best practices**
  (Both already loaded.) Re-confirm: count distinct existing reports for the cat, insert the new `Report`, and if the running count crosses `REPORT_HIDE_THRESHOLD` set `Cat.status = HIDDEN` — all in one interactive `$transaction` using `tx`.

- [ ] **Step 2: Write the failing test `src/moderation/reports.test.ts`**
  Mock `@/lib/prisma` with a `$transaction` that passes a `tx` stub. Full code:

  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  const tx = {
    cat: { findUnique: vi.fn(), update: vi.fn() },
    report: { create: vi.fn(), count: vi.fn() },
  };

  vi.mock("@/lib/prisma", () => ({
    prisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  }));

  import { createReport } from "./reports";

  const CAT_ID = "cat_1";
  const REPORTER = "anon:abc";

  describe("createReport", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      tx.cat.findUnique.mockResolvedValue({ id: CAT_ID, status: "ACTIVE" });
      tx.report.create.mockResolvedValue({ id: "rep_1" });
    });

    it("returns notFound when the cat does not exist", async () => {
      tx.cat.findUnique.mockResolvedValueOnce(null);
      const result = await createReport({ catId: CAT_ID, reporter: REPORTER });
      expect(result).toEqual({ ok: false, reason: "not_found" });
      expect(tx.report.create).not.toHaveBeenCalled();
    });

    it("inserts a report and does not hide below the threshold", async () => {
      tx.report.count.mockResolvedValueOnce(2); // below REPORT_HIDE_THRESHOLD (5)
      const result = await createReport({
        catId: CAT_ID,
        reporter: REPORTER,
        reason: "spam",
      });
      expect(result).toEqual({ ok: true, hidden: false });
      expect(tx.report.create).toHaveBeenCalledOnce();
      expect(tx.cat.update).not.toHaveBeenCalled();
    });

    it("auto-hides the cat at the report threshold", async () => {
      tx.report.count.mockResolvedValueOnce(5); // == REPORT_HIDE_THRESHOLD
      const result = await createReport({ catId: CAT_ID, reporter: REPORTER });
      expect(result).toEqual({ ok: true, hidden: true });
      expect(tx.cat.update).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        data: { status: "HIDDEN" },
      });
    });
  });
  ```

- [ ] **Step 3: Run the test, expect FAIL**
  ```bash
  npx vitest run src/moderation/reports.test.ts
  ```
  Expected: FAIL — `Cannot find module './reports'`.

- [ ] **Step 4: Write the implementation `src/moderation/reports.ts`**
  Full code:

  ```ts
  import { REPORT_HIDE_THRESHOLD } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";

  export type CreateReportInput = {
    catId: string;
    reporter: string; // anonId or "user:<id>"
    reason?: string;
  };

  export type CreateReportResult =
    | { ok: true; hidden: boolean }
    | { ok: false; reason: "not_found" };

  /**
   * Insert a Report and, if the cat crosses REPORT_HIDE_THRESHOLD, auto-set its
   * status to HIDDEN. Returns whether the cat was hidden by this report.
   */
  export async function createReport(
    input: CreateReportInput,
  ): Promise<CreateReportResult> {
    return prisma.$transaction(async (tx) => {
      const cat = await tx.cat.findUnique({
        where: { id: input.catId },
        select: { id: true, status: true },
      });
      if (!cat) {
        return { ok: false, reason: "not_found" } as const;
      }

      await tx.report.create({
        data: {
          catId: input.catId,
          reporter: input.reporter,
          reason: input.reason ?? null,
        },
      });

      const total = await tx.report.count({ where: { catId: input.catId } });
      if (total >= REPORT_HIDE_THRESHOLD && cat.status !== "HIDDEN") {
        await tx.cat.update({
          where: { id: input.catId },
          data: { status: "HIDDEN" },
        });
        return { ok: true, hidden: true } as const;
      }
      return { ok: true, hidden: false } as const;
    });
  }
  ```

- [ ] **Step 5: Run the test, expect PASS**
  ```bash
  npx vitest run src/moderation/reports.test.ts
  ```
  Expected: PASS — 3 tests passing.

- [ ] **Step 6: Write the route `src/app/api/report/route.ts`**
  Anonymous-allowed (reporter is anon or user). Resolves `reporter` from the optional session and the signed anon cookie; rate-limits via `check`. Full code matching the contract (`{ catId, reason? }` → 201 `{ ok: true }`; errors `400/404/429/500`):

  ```ts
  import { cookies } from "next/headers";
  import { NextResponse } from "next/server";
  import { z } from "zod";

  import { auth } from "@/auth";
  import { check } from "@/lib/rate-limit";
  import { createReport } from "@/moderation/reports";

  const ANON_COOKIE = "anonId";
  const MAX_REASON = 500;

  const BodySchema = z.object({
    catId: z.string().min(1),
    reason: z.string().max(MAX_REASON).optional(),
  });

  async function resolveReporter(): Promise<string> {
    const session = await auth();
    if (session?.user?.id) return `user:${session.user.id}`;
    const store = await cookies();
    const anon = store.get(ANON_COOKIE)?.value;
    return anon ? `anon:${anon}` : "anon:unknown";
  }

  export async function POST(request: Request): Promise<Response> {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const reporter = await resolveReporter();

    const limit = await check(`report:${reporter}`);
    if (!limit.ok) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    try {
      const result = await createReport({
        catId: parsed.data.catId,
        reporter,
        reason: parsed.data.reason,
      });
      if (!result.ok) {
        return NextResponse.json({ error: "Cat not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
  ```

- [ ] **Step 7: Typecheck**
  ```bash
  npm run typecheck
  ```
  Expected: PASS. (If the auth phase exports `auth` from `@/auth/index.ts` — per the contracts it does — this import resolves. The session `user.id` field is provided by the Auth.js Prisma adapter callback configured in the auth phase.)

- [ ] **Step 8: Commit**
  ```bash
  git add src/moderation/reports.ts src/moderation/reports.test.ts src/app/api/report/route.ts
  git commit -m "feat(moderation): reports module + POST /api/report with auto-hide threshold"
  ```

---

### Task 9: Admin actions module (`src/moderation/admin-actions.ts`)

**Files:**
- Create: `src/moderation/admin-actions.ts`
- Test: `src/moderation/admin-actions.test.ts`

- [ ] **Step 1: Load skill api-database-prisma and follow its best practices**
  (Already loaded.) Approving an image must also (re)promote its cat to `ACTIVE` if the cat is not banned — done in one `$transaction`. Other actions are single updates/deletes.

- [ ] **Step 2: Write the failing test `src/moderation/admin-actions.test.ts`**
  Full code:

  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  const tx = {
    catImage: { update: vi.fn() },
    cat: { update: vi.fn(), findUnique: vi.fn() },
  };

  vi.mock("@/lib/prisma", () => ({
    prisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      catImage: { update: vi.fn() },
      cat: { update: vi.fn(), delete: vi.fn() },
      user: { update: vi.fn() },
    },
  }));

  import { prisma } from "@/lib/prisma";
  import {
    approveImage,
    banCat,
    deleteCat,
    hideCat,
    rejectImage,
  } from "./admin-actions";

  const IMAGE_ID = "img_1";
  const CAT_ID = "cat_1";

  describe("admin-actions", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      tx.catImage.update.mockResolvedValue({ id: IMAGE_ID, catId: CAT_ID });
      tx.cat.findUnique.mockResolvedValue({ id: CAT_ID, status: "PENDING" });
      tx.cat.update.mockResolvedValue({ id: CAT_ID, status: "ACTIVE" });
    });

    it("approveImage approves the image and promotes a non-banned cat to ACTIVE", async () => {
      await approveImage(IMAGE_ID);
      expect(tx.catImage.update).toHaveBeenCalledWith({
        where: { id: IMAGE_ID },
        data: { status: "APPROVED" },
        select: { catId: true },
      });
      expect(tx.cat.update).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        data: { status: "ACTIVE", approvedAt: expect.any(Date) },
      });
    });

    it("approveImage does NOT promote a banned cat", async () => {
      tx.cat.findUnique.mockResolvedValueOnce({ id: CAT_ID, status: "BANNED" });
      await approveImage(IMAGE_ID);
      expect(tx.cat.update).not.toHaveBeenCalled();
    });

    it("rejectImage sets image REJECTED", async () => {
      await rejectImage(IMAGE_ID);
      expect(prisma.catImage.update).toHaveBeenCalledWith({
        where: { id: IMAGE_ID },
        data: { status: "REJECTED" },
      });
    });

    it("hideCat sets cat HIDDEN", async () => {
      await hideCat(CAT_ID);
      expect(prisma.cat.update).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        data: { status: "HIDDEN" },
      });
    });

    it("banCat sets cat BANNED", async () => {
      await banCat(CAT_ID);
      expect(prisma.cat.update).toHaveBeenCalledWith({
        where: { id: CAT_ID },
        data: { status: "BANNED" },
      });
    });

    it("deleteCat deletes the cat", async () => {
      await deleteCat(CAT_ID);
      expect(prisma.cat.delete).toHaveBeenCalledWith({ where: { id: CAT_ID } });
    });
  });
  ```

- [ ] **Step 3: Run the test, expect FAIL**
  ```bash
  npx vitest run src/moderation/admin-actions.test.ts
  ```
  Expected: FAIL — `Cannot find module './admin-actions'`.

- [ ] **Step 4: Write the implementation `src/moderation/admin-actions.ts`**
  Full code:

  ```ts
  import { prisma } from "@/lib/prisma";

  /** Approve one image; promote its cat to ACTIVE unless the cat is BANNED. */
  export async function approveImage(imageId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const image = await tx.catImage.update({
        where: { id: imageId },
        data: { status: "APPROVED" },
        select: { catId: true },
      });
      const cat = await tx.cat.findUnique({
        where: { id: image.catId },
        select: { id: true, status: true },
      });
      if (cat && cat.status !== "BANNED") {
        await tx.cat.update({
          where: { id: cat.id },
          data: { status: "ACTIVE", approvedAt: new Date() },
        });
      }
    });
  }

  export async function rejectImage(imageId: string): Promise<void> {
    await prisma.catImage.update({
      where: { id: imageId },
      data: { status: "REJECTED" },
    });
  }

  export async function hideCat(catId: string): Promise<void> {
    await prisma.cat.update({
      where: { id: catId },
      data: { status: "HIDDEN" },
    });
  }

  export async function banCat(catId: string): Promise<void> {
    await prisma.cat.update({
      where: { id: catId },
      data: { status: "BANNED" },
    });
  }

  export async function deleteCat(catId: string): Promise<void> {
    await prisma.cat.delete({ where: { id: catId } });
  }
  ```

- [ ] **Step 5: Run the test, expect PASS**
  ```bash
  npx vitest run src/moderation/admin-actions.test.ts
  ```
  Expected: PASS — 6 tests passing.

- [ ] **Step 6: Commit**
  ```bash
  git add src/moderation/admin-actions.ts src/moderation/admin-actions.test.ts
  git commit -m "feat(moderation): admin actions (approve/reject/hide/ban/delete)"
  ```

---

### Task 10: Client upload UI — dropzone + form

**Files:**
- Create: `src/components/upload/image-dropzone.tsx`
- Create: `src/components/upload/upload-form.tsx`

- [ ] **Step 1: Load skills web-files-image-handling, web-files-file-upload-patterns, web-forms-react-hook-form and web-forms-zod-validation and follow their best practices**
  Apply: object-URL previews with `URL.revokeObjectURL` cleanup (image-handling Pattern 1); dropzone with keyboard support + counter ref for nested drag events (file-upload Pattern 1); RHF `useForm<UploadFormValues>` with `zodResolver`, `mode: "onBlur"`, `defaultValues` (RHF Patterns 1 & 4); client validation is UX only — the server re-validates. Direct presigned PUT upload via XHR is NOT needed for progress here (small images ≤10MB) so a single `fetch(uploadUrl, { method: "PUT" })` per file is acceptable; if progress UI is later desired, switch to the XHR pattern from file-upload Pattern 3.

- [ ] **Step 2: Write `src/components/upload/image-dropzone.tsx`**
  Controlled file list with previews, enforces `MAX_IMAGES_PER_CAT`, validates MIME against `ALLOWED_UPLOAD_TYPES` and size against `MAX_UPLOAD_BYTES` (UX feedback). Full code:

  ```tsx
  "use client";

  import { useEffect, useRef, useState } from "react";

  import {
    ALLOWED_UPLOAD_TYPES,
    MAX_IMAGES_PER_CAT,
    MAX_UPLOAD_BYTES,
  } from "@/lib/constants";

  type ImageDropzoneProps = {
    files: File[];
    onChange: (files: File[]) => void;
    disabled?: boolean;
  };

  function isAllowed(file: File): boolean {
    return (
      (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type) &&
      file.size <= MAX_UPLOAD_BYTES
    );
  }

  export function ImageDropzone({
    files,
    onChange,
    disabled,
  }: ImageDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);
    const [dragging, setDragging] = useState(false);
    const [previews, setPreviews] = useState<string[]>([]);

    useEffect(() => {
      const urls = files.map((f) => URL.createObjectURL(f));
      setPreviews(urls);
      return () => {
        for (const url of urls) URL.revokeObjectURL(url);
      };
    }, [files]);

    function addFiles(incoming: FileList | null): void {
      if (!incoming) return;
      const accepted = Array.from(incoming).filter(isAllowed);
      const next = [...files, ...accepted].slice(0, MAX_IMAGES_PER_CAT);
      onChange(next);
    }

    function removeAt(index: number): void {
      onChange(files.filter((_, i) => i !== index));
    }

    const canAddMore = files.length < MAX_IMAGES_PER_CAT && !disabled;

    return (
      <div>
        <div
          role="button"
          tabIndex={canAddMore ? 0 : -1}
          aria-label="Image upload area. Click or drag cat photos to upload."
          data-dragging={dragging}
          onClick={() => canAddMore && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (canAddMore && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            dragCounter.current += 1;
            setDragging(true);
          }}
          onDragLeave={() => {
            dragCounter.current -= 1;
            if (dragCounter.current === 0) setDragging(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            dragCounter.current = 0;
            setDragging(false);
            if (canAddMore) addFiles(e.dataTransfer.files);
          }}
        >
          <p>Drag cat photos here, or click to choose (up to {MAX_IMAGES_PER_CAT}).</p>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_UPLOAD_TYPES.join(",")}
            multiple
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <ul>
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              {previews[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[index]} alt={`Preview of ${file.name}`} width={96} />
              ) : null}
              <button type="button" onClick={() => removeAt(index)} disabled={disabled}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  ```

- [ ] **Step 3: Write `src/components/upload/upload-form.tsx`**
  RHF + Zod; on submit it signs+PUTs each file to R2, then POSTs `/api/cats`. Full code:

  ```tsx
  "use client";

  import { zodResolver } from "@hookform/resolvers/zod";
  import { useRouter } from "next/navigation";
  import { useState } from "react";
  import { useForm } from "react-hook-form";
  import { z } from "zod";

  import { ImageDropzone } from "@/components/upload/image-dropzone";
  import {
    ALLOWED_UPLOAD_TYPES,
    MAX_IMAGES_PER_CAT,
    MAX_UPLOAD_BYTES,
  } from "@/lib/constants";

  const MIN_NAME = 1;
  const MAX_NAME = 60;

  const FormSchema = z.object({
    name: z.string().trim().min(MIN_NAME).max(MAX_NAME),
    files: z
      .array(z.instanceof(File))
      .min(1, "Add at least one photo")
      .max(MAX_IMAGES_PER_CAT)
      .refine(
        (fs) =>
          fs.every(
            (f) =>
              (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(f.type) &&
              f.size <= MAX_UPLOAD_BYTES,
          ),
        "Only JPEG/PNG/WebP up to 10MB",
      ),
  });

  type UploadFormValues = z.infer<typeof FormSchema>;

  type SignResponse = { uploadUrl: string; r2Key: string };

  async function uploadOne(file: File): Promise<{ r2Key: string }> {
    const signRes = await fetch("/api/upload/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    if (!signRes.ok) throw new Error("Could not get upload URL");
    const { uploadUrl, r2Key } = (await signRes.json()) as SignResponse;

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error("Upload failed");

    return { r2Key };
  }

  export function UploadForm() {
    const router = useRouter();
    const [submitError, setSubmitError] = useState<string | null>(null);

    const {
      handleSubmit,
      register,
      setValue,
      watch,
      formState: { errors, isSubmitting },
    } = useForm<UploadFormValues>({
      resolver: zodResolver(FormSchema),
      mode: "onBlur",
      defaultValues: { name: "", files: [] },
    });

    const files = watch("files");

    async function onSubmit(values: UploadFormValues): Promise<void> {
      setSubmitError(null);
      try {
        const uploaded = await Promise.all(values.files.map(uploadOne));
        const res = await fetch("/api/cats", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            images: uploaded.map((u) => ({ r2Key: u.r2Key })),
          }),
        });
        if (!res.ok) throw new Error("Could not create cat");
        const { slug } = (await res.json()) as { slug: string };
        router.push(`/cat/${slug}`);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      }
    }

    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        <label htmlFor="cat-name">Cat name</label>
        <input id="cat-name" {...register("name")} />
        {errors.name ? <span role="alert">{errors.name.message}</span> : null}

        <ImageDropzone
          files={files}
          onChange={(next) => setValue("files", next, { shouldValidate: true })}
          disabled={isSubmitting}
        />
        {errors.files ? (
          <span role="alert">{errors.files.message as string}</span>
        ) : null}

        {submitError ? <p role="alert">{submitError}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading…" : "Create cat"}
        </button>
      </form>
    );
  }
  ```

- [ ] **Step 4: Install the RHF zod resolver if missing**
  ```bash
  npm i @hookform/resolvers
  ```
  Expected: added to `dependencies` (react-hook-form and zod assumed already installed in the forms phase).

- [ ] **Step 5: Typecheck**
  ```bash
  npm run typecheck
  ```
  Expected: PASS (exit 0).

- [ ] **Step 6: Commit**
  ```bash
  git add src/components/upload/image-dropzone.tsx src/components/upload/upload-form.tsx package.json package-lock.json
  git commit -m "feat(upload): create-cat form with dropzone, presigned R2 upload, and POST /api/cats"
  ```

---

### Task 11: Admin queues UI + pages

**Files:**
- Create: `src/components/admin/moderation-queue.tsx`
- Create: `src/components/admin/report-queue.tsx`
- Create: `src/app/upload/page.tsx`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices**
  Read `.claude/skills/web-meta-framework-nextjs/SKILL.md`. Apply: `/upload` and `/admin` are server components that gate access via `requireUser`/`requireModerator` before rendering; admin actions run as **Server Actions** (`"use server"`) so no extra API routes are needed for moderation; `revalidatePath("/admin")` after each action.

- [ ] **Step 2: Write `src/components/admin/moderation-queue.tsx`**
  Server component listing PENDING images (and their cats) with approve/reject buttons wired to server actions. Full code:

  ```tsx
  import { revalidatePath } from "next/cache";

  import { requireModerator } from "@/auth/guards";
  import { prisma } from "@/lib/prisma";
  import {
    approveImage,
    banCat,
    deleteCat,
    hideCat,
    rejectImage,
  } from "@/moderation/admin-actions";
  import { thumbUrl } from "@/storage/keys";

  const ADMIN_PATH = "/admin";
  const QUEUE_LIMIT = 50;

  async function approveAction(formData: FormData): Promise<void> {
    "use server";
    await requireModerator();
    await approveImage(String(formData.get("imageId")));
    revalidatePath(ADMIN_PATH);
  }

  async function rejectAction(formData: FormData): Promise<void> {
    "use server";
    await requireModerator();
    await rejectImage(String(formData.get("imageId")));
    revalidatePath(ADMIN_PATH);
  }

  async function hideAction(formData: FormData): Promise<void> {
    "use server";
    await requireModerator();
    await hideCat(String(formData.get("catId")));
    revalidatePath(ADMIN_PATH);
  }

  async function banAction(formData: FormData): Promise<void> {
    "use server";
    await requireModerator();
    await banCat(String(formData.get("catId")));
    revalidatePath(ADMIN_PATH);
  }

  async function deleteAction(formData: FormData): Promise<void> {
    "use server";
    await requireModerator();
    await deleteCat(String(formData.get("catId")));
    revalidatePath(ADMIN_PATH);
  }

  export async function ModerationQueue() {
    const images = await prisma.catImage.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: QUEUE_LIMIT,
      select: {
        id: true,
        catId: true,
        cat: { select: { name: true, status: true } },
      },
    });

    return (
      <section aria-labelledby="moderation-heading">
        <h2 id="moderation-heading">Pending images ({images.length})</h2>
        <ul>
          {images.map((image) => (
            <li key={image.id}>
              <img src={thumbUrl(image.id)} alt={`Pending ${image.cat.name}`} width={120} />
              <span>{image.cat.name}</span>
              <form action={approveAction}>
                <input type="hidden" name="imageId" value={image.id} />
                <button type="submit">Approve</button>
              </form>
              <form action={rejectAction}>
                <input type="hidden" name="imageId" value={image.id} />
                <button type="submit">Reject</button>
              </form>
              <form action={hideAction}>
                <input type="hidden" name="catId" value={image.catId} />
                <button type="submit">Hide cat</button>
              </form>
              <form action={banAction}>
                <input type="hidden" name="catId" value={image.catId} />
                <button type="submit">Ban cat</button>
              </form>
              <form action={deleteAction}>
                <input type="hidden" name="catId" value={image.catId} />
                <button type="submit">Delete cat</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  ```

- [ ] **Step 3: Write `src/components/admin/report-queue.tsx`**
  Server component listing reported cats (grouped count, prioritizing HIDDEN) with hide/ban/delete. Reuses the same server actions by importing them is not possible across files cleanly without re-declaring, so define the report-queue's own thin server actions. Full code:

  ```tsx
  import { revalidatePath } from "next/cache";

  import { requireModerator } from "@/auth/guards";
  import { prisma } from "@/lib/prisma";
  import { banCat, deleteCat, hideCat } from "@/moderation/admin-actions";

  const ADMIN_PATH = "/admin";
  const REPORT_QUEUE_LIMIT = 50;

  async function hideAction(formData: FormData): Promise<void> {
    "use server";
    await requireModerator();
    await hideCat(String(formData.get("catId")));
    revalidatePath(ADMIN_PATH);
  }

  async function banAction(formData: FormData): Promise<void> {
    "use server";
    await requireModerator();
    await banCat(String(formData.get("catId")));
    revalidatePath(ADMIN_PATH);
  }

  async function deleteAction(formData: FormData): Promise<void> {
    "use server";
    await requireModerator();
    await deleteCat(String(formData.get("catId")));
    revalidatePath(ADMIN_PATH);
  }

  export async function ReportQueue() {
    const grouped = await prisma.report.groupBy({
      by: ["catId"],
      _count: { catId: true },
      orderBy: { _count: { catId: "desc" } },
      take: REPORT_QUEUE_LIMIT,
    });

    const catIds = grouped.map((g) => g.catId);
    const cats = await prisma.cat.findMany({
      where: { id: { in: catIds } },
      select: { id: true, name: true, slug: true, status: true },
    });
    const byId = new Map(cats.map((c) => [c.id, c]));

    return (
      <section aria-labelledby="reports-heading">
        <h2 id="reports-heading">Reported cats ({grouped.length})</h2>
        <ul>
          {grouped.map((row) => {
            const cat = byId.get(row.catId);
            if (!cat) return null;
            return (
              <li key={row.catId}>
                <span>
                  {cat.name} — {row._count.catId} reports — {cat.status}
                </span>
                <form action={hideAction}>
                  <input type="hidden" name="catId" value={cat.id} />
                  <button type="submit">Hide</button>
                </form>
                <form action={banAction}>
                  <input type="hidden" name="catId" value={cat.id} />
                  <button type="submit">Ban</button>
                </form>
                <form action={deleteAction}>
                  <input type="hidden" name="catId" value={cat.id} />
                  <button type="submit">Delete</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
  ```

- [ ] **Step 4: Write `src/app/upload/page.tsx`**
  Auth-gated server page. Full code:

  ```tsx
  import { redirect } from "next/navigation";

  import { UploadForm } from "@/components/upload/upload-form";
  import { requireUser } from "@/auth/guards";

  export default async function UploadPage() {
    const user = await requireUser();
    if (!user) {
      redirect("/api/auth/signin?callbackUrl=/upload");
    }
    return (
      <main>
        <h1>Upload a cat</h1>
        <UploadForm />
      </main>
    );
  }
  ```

- [ ] **Step 5: Write `src/app/admin/page.tsx`**
  Admin-gated server page composing both queues. Full code:

  ```tsx
  import { redirect } from "next/navigation";

  import { ModerationQueue } from "@/components/admin/moderation-queue";
  import { ReportQueue } from "@/components/admin/report-queue";
  import { requireModerator } from "@/auth/guards";

  export default async function AdminPage() {
    const admin = await requireModerator();
    if (!admin) {
      redirect("/");
    }
    return (
      <main>
        <h1>Moderation</h1>
        <ModerationQueue />
        <ReportQueue />
      </main>
    );
  }
  ```

- [ ] **Step 6: Typecheck**
  ```bash
  npm run typecheck
  ```
  Expected: PASS (exit 0). (If `requireUser`/`requireModerator` from the auth phase already `redirect` internally rather than returning `null`, drop the local `redirect` guards and just call them — align to the exported behavior without changing the auth module.)

- [ ] **Step 7: Commit**
  ```bash
  git add src/components/admin/moderation-queue.tsx src/components/admin/report-queue.tsx src/app/upload/page.tsx src/app/admin/page.tsx
  git commit -m "feat(admin): moderation + report queues with server actions, upload/admin pages"
  ```

---

### Task 12: Full-phase verification

**Files:**
- (no new files)

- [ ] **Step 1: Load skill web-testing-vitest and follow its best practices**
  Confirm all tests use co-located naming, named constants, mocked external boundaries, and v3+ options syntax.

- [ ] **Step 2: Run the whole test suite for this phase**
  ```bash
  npx vitest run src/storage src/moderation src/app/api/cats
  ```
  Expected: PASS — all suites green: `keys` (2), `upload-sign` (2), `process-image` (1), `screen-image` (6), `reports` (3), `admin-actions` (6), `cats/route` (5).

- [ ] **Step 3: Lint and typecheck the whole repo**
  ```bash
  npm run lint && npm run typecheck
  ```
  Expected: PASS — Biome reports no errors; `tsc --noEmit` exits 0. Fix import ordering / unused-import issues if Biome flags them (do not change behavior).

- [ ] **Step 4: Confirm no contract drift**
  Manually verify the route response shapes against `docs/superpowers/plans/2026-06-02-00-contracts.md` §6: `/api/upload/sign` returns `{ uploadUrl, r2Key }`; `/api/cats` returns 201 `{ id, slug, status }` with error codes `400/401/409/422/500`; `/api/report` returns 201 `{ ok: true }` with `400/404/429/500`. No divergent field names introduced.

- [ ] **Step 5: Final commit**
  ```bash
  git add -A
  git commit -m "test(upload-moderation): verify full phase suite, lint, and typecheck green"
  ```
