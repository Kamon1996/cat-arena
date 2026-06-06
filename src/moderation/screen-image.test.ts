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

  it("APPROVED with the confidence score when resnet-50 is confident it is a cat", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      aiResponse([{ label: "tabby cat", score: 0.9 }]),
    );
    expect(await screenImage(BUF)).toEqual({ status: "APPROVED", catConfidence: 0.9 });
  });

  it("APPROVED when confidence is at the (lowered) threshold", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      aiResponse([{ label: "tiger cat", score: 0.25 }]),
    );
    expect(await screenImage(BUF)).toEqual({ status: "APPROVED", catConfidence: 0.25 });
  });

  it("PENDING when cat confidence is below the threshold", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      aiResponse([{ label: "tiger cat", score: 0.2 }]),
    );
    expect(await screenImage(BUF)).toEqual({ status: "PENDING", catConfidence: 0.2 });
  });

  it("PENDING with zero confidence when the top label is not a cat (e.g. a dog)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      aiResponse([{ label: "toy poodle", score: 0.95 }]),
    );
    expect(await screenImage(BUF)).toEqual({ status: "PENDING", catConfidence: 0 });
  });

  it("PENDING with zero confidence when the image is not an animal at all", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      aiResponse([{ label: "toaster", score: 0.95 }]),
    );
    expect(await screenImage(BUF)).toEqual({ status: "PENDING", catConfidence: 0 });
  });

  it("fails safe to PENDING when the free-tier quota is exhausted (HTTP 429)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    // No local fallback model — an unscreened image must never auto-approve.
    expect(await screenImage(BUF)).toEqual({ status: "PENDING", catConfidence: 0 });
  });

  it("fails safe to PENDING when Cloudflare reports out-of-credits (code 3036)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, errors: [{ code: 3036 }] }), { status: 403 }),
    );
    expect(await screenImage(BUF)).toEqual({ status: "PENDING", catConfidence: 0 });
  });
});
