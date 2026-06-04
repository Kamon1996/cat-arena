import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  presignPut: vi.fn(async () => "https://r2.example/presigned-put"),
}));

import { presignPut } from "@/lib/r2";
import { buildUploadSign } from "./upload-sign";

const CONTENT_TYPE = "image/jpeg";

describe("buildUploadSign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an uploadUrl and an original r2Key under cats/<id>/original", async () => {
    const result = await buildUploadSign(CONTENT_TYPE);
    expect(result.uploadUrl).toBe("https://r2.example/presigned-put");
    expect(result.r2Key).toMatch(/^cats\/[^/]+\/original$/);
    expect(presignPut).toHaveBeenCalledWith(result.r2Key, CONTENT_TYPE);
  });

  it("mints a unique key per call", async () => {
    const a = await buildUploadSign(CONTENT_TYPE);
    const b = await buildUploadSign(CONTENT_TYPE);
    expect(a.r2Key).not.toBe(b.r2Key);
  });
});
