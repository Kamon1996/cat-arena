import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, buildSignMock, dedupeMock, burstMock, dailyMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  buildSignMock: vi.fn(),
  dedupeMock: vi.fn(),
  burstMock: vi.fn(),
  dailyMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/storage/upload-sign", () => ({ buildUploadSign: buildSignMock }));
vi.mock("@/storage/image-dedupe", () => ({
  SHA256_HEX_PATTERN: /^[a-f0-9]{64}$/,
  isDuplicateImage: dedupeMock,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkUploadBurst: burstMock,
  checkUploadDaily: dailyMock,
}));

import { POST } from "./route";

const SESSION = { user: { id: "user_1" }, expires: "2999-01-01" };
const SHA256_FIXTURE = "a".repeat(64);

function req(body: unknown): Request {
  return new Request("http://localhost/api/upload/sign", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/upload/sign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(SESSION);
    buildSignMock.mockResolvedValue({
      uploadUrl: "https://r2.test/put",
      r2Key: "cats/img_1/original",
    });
    dedupeMock.mockResolvedValue(false);
    burstMock.mockResolvedValue({ ok: true, remaining: 9 });
    dailyMock.mockResolvedValue({ ok: true, remaining: 29 });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await POST(req({ contentType: "image/jpeg", size: 100 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a disallowed content type", async () => {
    const res = await POST(req({ contentType: "image/gif", size: 100 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed sha256", async () => {
    const res = await POST(req({ contentType: "image/jpeg", size: 100, sha256: "not-a-hash" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when the minute budget is exhausted, before the dedupe oracle", async () => {
    burstMock.mockResolvedValueOnce({ ok: false, remaining: 0 });
    const res = await POST(req({ contentType: "image/jpeg", size: 100, sha256: SHA256_FIXTURE }));
    expect(res.status).toBe(429);
    // The hash-existence check must cost budget — no free probing when limited.
    expect(dedupeMock).not.toHaveBeenCalled();
    expect(buildSignMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the daily upload cap is reached", async () => {
    dailyMock.mockResolvedValueOnce({ ok: false, remaining: 0 });
    const res = await POST(req({ contentType: "image/jpeg", size: 100 }));
    expect(res.status).toBe(429);
    expect(buildSignMock).not.toHaveBeenCalled();
  });

  it("returns 409 before signing when the hash is already stored", async () => {
    dedupeMock.mockResolvedValueOnce(true);
    const res = await POST(req({ contentType: "image/jpeg", size: 100, sha256: SHA256_FIXTURE }));
    expect(res.status).toBe(409);
    expect(buildSignMock).not.toHaveBeenCalled();
  });

  it("signs the upload when the hash is new", async () => {
    const res = await POST(req({ contentType: "image/jpeg", size: 100, sha256: SHA256_FIXTURE }));
    expect(res.status).toBe(200);
    expect(dedupeMock).toHaveBeenCalledWith([SHA256_FIXTURE]);
    const json = await res.json();
    expect(json).toEqual({ uploadUrl: "https://r2.test/put", r2Key: "cats/img_1/original" });
  });

  it("still signs without a sha256 (legacy clients), skipping the dedupe check", async () => {
    const res = await POST(req({ contentType: "image/jpeg", size: 100 }));
    expect(res.status).toBe(200);
    expect(dedupeMock).not.toHaveBeenCalled();
  });
});
