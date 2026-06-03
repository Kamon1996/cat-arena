import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "tok" },
}));

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
      return Promise.resolve(aiResponse([{ label: "tabby cat", score: 0.9 }]));
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
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.mocked(nsfwFallbackScore).mockResolvedValueOnce(0.05);
    // clean per fallback, cat-confidence unknown → PENDING
    expect(await screenImage(BUF)).toBe("PENDING");
    expect(nsfwFallbackScore).toHaveBeenCalledOnce();
  });

  it("falls back and REJECTS when NSFWJS says unsafe", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.mocked(nsfwFallbackScore).mockResolvedValueOnce(0.95);
    expect(await screenImage(BUF)).toBe("REJECTED");
  });
});
