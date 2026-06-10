import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A real 2x2 PNG so sharp can decode/resize it.
const PNG_2X2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNkYGD4z8DAwMgAAwAQAAH/Lh3xAAAAAElFTkSuQmCC",
  "base64",
);

const sent: Array<{ Key?: string; ContentType?: string; size: number }> = [];

vi.mock("@/lib/env", () => ({
  env: {
    R2_BUCKET: "test-bucket",
  },
}));

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

vi.mock("@/lib/r2", () => {
  const send = vi.fn(async (command: { input: Record<string, unknown> }) => {
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
  });
  return { getR2: () => ({ send }) };
});

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

  it("returns the SHA-256 hex of the original bytes as uploaded", async () => {
    const result = await processImage(IMAGE_ID);
    expect(result.sha256).toBe(createHash("sha256").update(PNG_2X2).digest("hex"));
  });
});
