import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { processMock, screenMock } = vi.hoisted(() => ({
  processMock: vi.fn(),
  screenMock: vi.fn(),
}));

vi.mock("@/storage/process-image", () => ({ processImage: processMock }));
vi.mock("@/moderation/screen-image", () => ({ screenImage: screenMock }));

import { ingestImage } from "./ingest-image";

describe("ingestImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processMock.mockResolvedValue({
      width: 800,
      height: 600,
      screenBuffer: Buffer.from([1]),
    });
    screenMock.mockResolvedValue("APPROVED");
  });

  it("processes then screens, returning dims and status", async () => {
    const result = await ingestImage("img_1");
    expect(processMock).toHaveBeenCalledWith("img_1");
    expect(screenMock).toHaveBeenCalledWith(Buffer.from([1]));
    expect(result).toEqual({ width: 800, height: 600, status: "APPROVED" });
  });

  it("passes through a PENDING screen verdict", async () => {
    screenMock.mockResolvedValueOnce("PENDING");
    const result = await ingestImage("img_2");
    expect(result.status).toBe("PENDING");
  });
});
