import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import sharp from "sharp";
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

  it("writes thumb, card and UNCROPPED full WebP variants and returns dimensions", async () => {
    const result = await processImage(IMAGE_ID);

    const keys = sent.map((s) => s.Key);
    expect(keys).toContain(`cats/${IMAGE_ID}/thumb.webp`);
    expect(keys).toContain(`cats/${IMAGE_ID}/card.webp`);
    expect(keys).toContain(`cats/${IMAGE_ID}/full.webp`);
    expect(sent.every((s) => s.ContentType === "image/webp")).toBe(true);
    expect(sent.every((s) => s.size > 0)).toBe(true);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  it("returns the SHA-256 hex of the original bytes as uploaded", async () => {
    const result = await processImage(IMAGE_ID);
    expect(result.sha256).toBe(createHash("sha256").update(PNG_2X2).digest("hex"));
  });

  it("applies the framing crop to duel variants while dims stay uncropped", async () => {
    const result = await processImage(IMAGE_ID, undefined, { x: 0, y: 0, width: 1, height: 1 });

    // All three variants still produced (full from the uncropped source).
    const keys = sent.map((s) => s.Key);
    expect(keys).toContain(`cats/${IMAGE_ID}/thumb.webp`);
    expect(keys).toContain(`cats/${IMAGE_ID}/full.webp`);
    // Reported dimensions describe the ORIGINAL, not the crop.
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    // The applied framing is reported back so callers can persist it.
    expect(result.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("screens the FULL photo, not the duel crop", async () => {
    const result = await processImage(IMAGE_ID, undefined, { x: 0, y: 0, width: 1, height: 1 });
    // The crop is 1x1, but moderation must see everything the public can see.
    const screenMeta = await sharp(result.screenBuffer).metadata();
    expect(screenMeta.format).toBe("jpeg");
    expect(screenMeta.width).toBe(2);
    expect(screenMeta.height).toBe(2);
  });

  it("drops a fully out-of-bounds crop instead of snapping to a 1px sliver", async () => {
    const result = await processImage(IMAGE_ID, undefined, {
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });
    expect(result.width).toBe(2);
    expect(result.crop).toBeNull();
    // The duel variants fall back to the uncropped photo (2x2), not a sliver.
    const thumb = sent.find((s) => s.Key === `cats/${IMAGE_ID}/thumb.webp`);
    expect(thumb).toBeDefined();
  });

  it("intersects a partially out-of-bounds crop with the image", async () => {
    const result = await processImage(IMAGE_ID, undefined, { x: 1, y: 1, width: 50, height: 50 });
    expect(result.crop).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });

  it("reports orientation-adjusted dimensions and crops in display space (EXIF 6)", async () => {
    // Raw 4x2 JPEG + EXIF orientation 6 = the browser displays it as 2x4
    // (portrait). The crop rect arrives in that displayed space.
    const exifJpeg = await sharp({
      create: { width: 4, height: 2, channels: 3, background: { r: 255, g: 128, b: 0 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await processImage(IMAGE_ID, exifJpeg, { x: 0, y: 2, width: 2, height: 2 });

    // Display-space dims, not the raw header's 4x2.
    expect(result.width).toBe(2);
    expect(result.height).toBe(4);
    // y=2 is valid in display space — must survive the clamp un-mangled.
    expect(result.crop).toEqual({ x: 0, y: 2, width: 2, height: 2 });

    const card = sent.find((s) => s.Key === `cats/${IMAGE_ID}/card.webp`);
    expect(card).toBeDefined();
  });
});
