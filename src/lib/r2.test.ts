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
  ListObjectsV2Command: class {
    input: { Bucket?: string; Prefix?: string; MaxKeys?: number; ContinuationToken?: string };
    constructor(input: {
      Bucket?: string;
      Prefix?: string;
      MaxKeys?: number;
      ContinuationToken?: string;
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
    S3_REGION: "auto",
    S3_FORCE_PATH_STYLE: false,
  },
}));

import { deleteObjects, listKeys } from "./r2";

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

describe("listKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  type ListCommand = {
    input: { Prefix?: string; MaxKeys?: number; ContinuationToken?: string };
  };

  it("returns a single page and stops when the listing is not truncated", async () => {
    sendMock.mockResolvedValueOnce({
      Contents: [{ Key: "cats/a/original" }, { Key: "cats/b/original" }],
      IsTruncated: false,
    });
    const keys = await listKeys("cats/", 1000);
    expect(keys.map((k) => k.key)).toEqual(["cats/a/original", "cats/b/original"]);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("follows continuation tokens across pages instead of re-scanning page one", async () => {
    sendMock
      .mockResolvedValueOnce({
        Contents: [{ Key: "cats/a/original" }, { Key: "cats/b/original" }],
        IsTruncated: true,
        NextContinuationToken: "token-1",
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "cats/c/original" }],
        IsTruncated: false,
      });

    const keys = await listKeys("cats/", 3);
    expect(keys.map((k) => k.key)).toEqual([
      "cats/a/original",
      "cats/b/original",
      "cats/c/original",
    ]);
    expect(sendMock).toHaveBeenCalledTimes(2);

    const second = sendMock.mock.calls[1]?.[0] as ListCommand;
    expect(second.input.ContinuationToken).toBe("token-1");
    // The second page only needs to fill the remaining budget (3 - 2 = 1).
    expect(second.input.MaxKeys).toBe(1);
  });

  it("stops at maxKeys even when more pages remain", async () => {
    sendMock.mockResolvedValueOnce({
      Contents: [{ Key: "cats/a/original" }, { Key: "cats/b/original" }],
      IsTruncated: true,
      NextContinuationToken: "token-1",
    });
    const keys = await listKeys("cats/", 2);
    expect(keys).toHaveLength(2);
    expect(sendMock).toHaveBeenCalledOnce();
  });
});
