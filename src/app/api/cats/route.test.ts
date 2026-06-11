import { Buffer } from "node:buffer";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_UPLOAD_BYTES } from "@/lib/constants";

const {
  authMock,
  slugMock,
  processMock,
  fetchOriginalMock,
  screenMock,
  burstMock,
  catCount,
  catCreate,
  catUpdate,
  imageFindFirst,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  slugMock: vi.fn(() => "fluffy-abc123"),
  processMock: vi.fn(),
  fetchOriginalMock: vi.fn(),
  screenMock: vi.fn(),
  burstMock: vi.fn(),
  catCount: vi.fn(),
  catCreate: vi.fn(),
  catUpdate: vi.fn(),
  imageFindFirst: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/slug", () => ({ slug: slugMock }));
vi.mock("@/storage/process-image", () => ({
  processImage: processMock,
  // The route pre-fetches and hashes originals before any processing. The
  // mocked buffer carries the image id, and the fake hash is derived from the
  // buffer content — opaque to the route, stable per image, equal for equal bytes.
  fetchOriginal: fetchOriginalMock,
  sha256OfBuffer: (buffer: Buffer) => `sha-${buffer.toString("utf8")}`,
}));
vi.mock("@/moderation/screen-image", () => ({ screenImage: screenMock }));
vi.mock("@/lib/rate-limit", () => ({ checkUploadBurst: burstMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cat: { count: catCount, create: catCreate, update: catUpdate },
    catImage: { findFirst: imageFindFirst },
  },
}));

import { POST } from "./route";

// Mirrors the mocked sha256OfBuffer above: the buffer holds the image id, so
// distinct ids → distinct hashes, identical bytes → identical hashes.
const hashFor = (id: string): string => `sha-${id}`;

const SESSION = { user: { id: "user_1", role: "USER" }, expires: "2999-01-01" };

function req(body: unknown): Request {
  return new Request("http://localhost/api/cats", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/cats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(SESSION);
    slugMock.mockReturnValue("fluffy-abc123");
    // The fetched "original" carries the image id as its bytes (see the
    // sha256OfBuffer mock above).
    fetchOriginalMock.mockImplementation(async (id: string) => Buffer.from(id, "utf8"));
    processMock.mockImplementation(async (id: string) => ({
      width: 800,
      height: 600,
      screenBuffer: Buffer.from([1]),
      sha256: hashFor(id),
    }));
    screenMock.mockResolvedValue({ status: "APPROVED", catConfidence: 0.9 });
    burstMock.mockResolvedValue({ ok: true, remaining: 9 });
    catCount.mockResolvedValue(0);
    imageFindFirst.mockResolvedValue(null);
    catCreate.mockResolvedValue({
      id: "cat_1",
      slug: "fluffy-abc123",
      status: "PENDING",
    });
    catUpdate.mockResolvedValue({
      id: "cat_1",
      slug: "fluffy-abc123",
      status: "ACTIVE",
    });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/x/original" }] }));
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

  it("returns 429 when the upload budget is exhausted, before any work", async () => {
    burstMock.mockResolvedValueOnce({ ok: false, remaining: 0 });
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    expect(res.status).toBe(429);
    expect(fetchOriginalMock).not.toHaveBeenCalled();
    expect(catCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the user is at the cat limit", async () => {
    catCount.mockResolvedValueOnce(2);
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    expect(res.status).toBe(409);
  });

  it("creates a cat and promotes it to ACTIVE when an image is APPROVED", async () => {
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({
      id: "cat_1",
      slug: "fluffy-abc123",
      status: "ACTIVE",
      screens: [{ status: "APPROVED", catConfidence: 0.9 }],
    });
    expect(catUpdate).toHaveBeenCalled();
  });

  it("stays PENDING when no image is APPROVED", async () => {
    screenMock.mockResolvedValue({ status: "PENDING", catConfidence: 0.1 });
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    const json = await res.json();
    expect(json.status).toBe("PENDING");
    expect(catUpdate).not.toHaveBeenCalled();
  });

  it("passes each image's framing crop through to processing", async () => {
    const crop = { x: 10, y: 20, width: 300, height: 300 };
    await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original", crop }] }));
    expect(processMock).toHaveBeenCalledWith("a", expect.anything(), crop);
  });

  it("rejects a malformed crop rect", async () => {
    const res = await POST(
      req({
        name: "Fluffy",
        images: [{ r2Key: "cats/a/original", crop: { x: -5, y: 0, width: 0, height: 10 } }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("stores each image's sha256 on create", async () => {
    await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    const createArgs = catCreate.mock.calls[0]?.[0] as {
      data: { images: { create: Array<{ sha256: string }> } };
    };
    expect(createArgs.data.images.create[0]?.sha256).toBe(hashFor("a"));
  });

  it("returns 409 when the same photo is submitted twice in one request, before any processing", async () => {
    // Both "originals" carry identical bytes → identical hashes.
    fetchOriginalMock.mockResolvedValue(Buffer.from("same-bytes", "utf8"));
    const res = await POST(
      req({
        name: "Fluffy",
        images: [{ r2Key: "cats/a/original" }, { r2Key: "cats/b/original" }],
      }),
    );
    expect(res.status).toBe(409);
    expect(catCreate).not.toHaveBeenCalled();
    // The DoS guard: duplicates must be rejected BEFORE sharp / Workers AI run.
    expect(processMock).not.toHaveBeenCalled();
    expect(screenMock).not.toHaveBeenCalled();
  });

  it("returns 409 when a photo's hash is already stored, before any processing", async () => {
    imageFindFirst.mockResolvedValueOnce({ id: "img_existing" });
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    expect(res.status).toBe(409);
    expect(imageFindFirst).toHaveBeenCalledWith({
      where: { sha256: { in: [hashFor("a")] } },
      select: { id: true },
    });
    expect(catCreate).not.toHaveBeenCalled();
    expect(processMock).not.toHaveBeenCalled();
    expect(screenMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the uploaded bytes exceed the size limit (declared size is advisory)", async () => {
    fetchOriginalMock.mockResolvedValueOnce(Buffer.alloc(MAX_UPLOAD_BYTES + 1));
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    expect(res.status).toBe(400);
    expect(processMock).not.toHaveBeenCalled();
    expect(catCreate).not.toHaveBeenCalled();
  });

  it("maps a sha256 unique-violation race on create to 409, not 500", async () => {
    catCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique violation", {
        code: "P2002",
        clientVersion: "6.0.0",
        meta: { target: ["sha256"] },
      }),
    );
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    expect(res.status).toBe(409);
  });

  it("does NOT mask an unrelated unique violation (e.g. slug) as a duplicate photo", async () => {
    catCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique violation", {
        code: "P2002",
        clientVersion: "6.0.0",
        meta: { target: ["slug"] },
      }),
    );
    const res = await POST(req({ name: "Fluffy", images: [{ r2Key: "cats/a/original" }] }));
    expect(res.status).toBe(500);
  });
});
