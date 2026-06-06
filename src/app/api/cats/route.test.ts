import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, slugMock, processMock, screenMock, catCount, catCreate, catUpdate } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    slugMock: vi.fn(() => "fluffy-abc123"),
    processMock: vi.fn(),
    screenMock: vi.fn(),
    catCount: vi.fn(),
    catCreate: vi.fn(),
    catUpdate: vi.fn(),
  }),
);

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/slug", () => ({ slug: slugMock }));
vi.mock("@/storage/process-image", () => ({ processImage: processMock }));
vi.mock("@/moderation/screen-image", () => ({ screenImage: screenMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { cat: { count: catCount, create: catCreate, update: catUpdate } },
}));

import { POST } from "./route";

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
    processMock.mockResolvedValue({
      width: 800,
      height: 600,
      screenBuffer: Buffer.from([1]),
    });
    screenMock.mockResolvedValue({ status: "APPROVED", catConfidence: 0.9 });
    catCount.mockResolvedValue(0);
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
});
