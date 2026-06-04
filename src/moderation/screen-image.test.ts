import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "tok" },
}));

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

  it("fails safe to PENDING (manual queue) when Workers AI is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    // No local fallback model — an unscreened image must never auto-approve/reject.
    expect(await screenImage(BUF)).toBe("PENDING");
  });
});
