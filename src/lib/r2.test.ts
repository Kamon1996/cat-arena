import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendMock;
  },
  PutObjectCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  DeleteObjectsCommand: class {
    input: { Bucket?: string; Delete?: { Objects?: Array<{ Key: string }> } };
    constructor(input: {
      Bucket?: string;
      Delete?: { Objects?: Array<{ Key: string }> };
    }) {
      this.input = input;
    }
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));

vi.mock("@/lib/env", () => ({
  env: {
    R2_ACCOUNT_ID: "acct",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "bucket",
    R2_PUBLIC_URL: "https://cdn.test",
  },
}));

import { deleteObjects } from "./r2";

describe("deleteObjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a DeleteObjectsCommand with all keys", async () => {
    sendMock.mockResolvedValueOnce({});
    await deleteObjects(["cats/a/original", "cats/a/thumb.webp"]);
    expect(sendMock).toHaveBeenCalledOnce();
    const command = sendMock.mock.calls[0]?.[0] as {
      input: { Bucket: string; Delete: { Objects: Array<{ Key: string }> } };
    };
    expect(command.input.Bucket).toBe("bucket");
    expect(command.input.Delete.Objects).toEqual([
      { Key: "cats/a/original" },
      { Key: "cats/a/thumb.webp" },
    ]);
  });

  it("does nothing when given no keys", async () => {
    await deleteObjects([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never throws even if the R2 send fails (best-effort cleanup)", async () => {
    sendMock.mockRejectedValueOnce(new Error("network"));
    await expect(deleteObjects(["cats/a/original"])).resolves.toBeUndefined();
  });
});
