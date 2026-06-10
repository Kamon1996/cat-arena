import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { processMock, screenMock } = vi.hoisted(() => ({
  processMock: vi.fn(),
  screenMock: vi.fn(),
}));

vi.mock("@/storage/process-image", () => ({ processImage: processMock }));
vi.mock("@/moderation/screen-image", () => ({ screenImage: screenMock }));

import { ingestImage } from "./ingest-image";

const SHA256_FIXTURE = "a".repeat(64);

describe("ingestImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processMock.mockResolvedValue({
      width: 800,
      height: 600,
      screenBuffer: Buffer.from([1]),
      sha256: SHA256_FIXTURE,
    });
    screenMock.mockResolvedValue({ status: "APPROVED", catConfidence: 0.9 });
  });

  it("processes then screens, returning dims, status, confidence, and hash", async () => {
    const result = await ingestImage("img_1");
    // No prefetched buffer → processImage downloads the original itself.
    expect(processMock).toHaveBeenCalledWith("img_1", undefined);
    expect(screenMock).toHaveBeenCalledWith(Buffer.from([1]));
    expect(result).toEqual({
      width: 800,
      height: 600,
      status: "APPROVED",
      catConfidence: 0.9,
      sha256: SHA256_FIXTURE,
    });
  });

  it("passes through a PENDING screen verdict", async () => {
    screenMock.mockResolvedValueOnce({ status: "PENDING", catConfidence: 0.1 });
    const result = await ingestImage("img_2");
    expect(result.status).toBe("PENDING");
  });
});
