import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { hashMock } = vi.hoisted(() => ({ hashMock: vi.fn() }));
vi.mock("@/lib/sha256-file", () => ({ sha256HexOfFile: hashMock }));

import type { PickedPhoto } from "./image-dropzone";
import { useEagerUploads } from "./use-eager-uploads";

const SHA = "a".repeat(64);
const SIGN = { uploadUrl: "https://r2.test/put", r2Key: "cats/img1/original" };

type ProgressPayload = { lengthComputable: boolean; loaded: number; total: number };

class FakeXhr {
  static instances: FakeXhr[] = [];
  upload: { onprogress: ((event: ProgressPayload) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  aborted = false;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  constructor() {
    FakeXhr.instances.push(this);
  }
  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }
}

const fetchMock = vi.fn();

function photo(id = "p1"): PickedPhoto {
  return { id, file: new File(["x"], "a.png", { type: "image/png" }), crop: null };
}

function signOk(): Response {
  return { ok: true, json: async () => SIGN } as unknown as Response;
}

describe("useEagerUploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeXhr.instances = [];
    hashMock.mockResolvedValue(SHA);
    fetchMock.mockResolvedValue(signOk());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });

  it("uploads a new photo: hash → sign → PUT with live progress", async () => {
    const { result } = renderHook(() => useEagerUploads());
    act(() => result.current.sync([photo()]));

    await waitFor(() => expect(result.current.entries.p1?.status).toBe("uploading"));
    // The sign request carries the client hash for the early duplicate check.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload/sign",
      expect.objectContaining({ body: expect.stringContaining(SHA) }),
    );

    const xhr = FakeXhr.instances[0];
    expect(xhr).toBeDefined();
    act(() => xhr?.upload.onprogress?.({ lengthComputable: true, loaded: 45, total: 100 }));
    expect(result.current.entries.p1?.progress).toBe(45);

    if (xhr) {
      xhr.status = 200;
    }
    act(() => xhr?.onload?.());
    await waitFor(() => expect(result.current.entries.p1?.status).toBe("uploaded"));
    expect(result.current.entries.p1?.r2Key).toBe(SIGN.r2Key);

    await expect(result.current.waitAll(["p1"])).resolves.toEqual({
      ok: true,
      keys: { p1: SIGN.r2Key },
    });
  });

  it("surfaces a sign rejection (409 duplicate) on the photo's entry, retry restarts", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "This photo has already been uploaded" }),
    } as unknown as Response);

    const { result } = renderHook(() => useEagerUploads());
    act(() => result.current.sync([photo()]));

    await waitFor(() => expect(result.current.entries.p1?.status).toBe("error"));
    expect(result.current.entries.p1?.error).toBe("This photo has already been uploaded");
    await expect(result.current.waitAll(["p1"])).resolves.toEqual({ ok: false });

    act(() => result.current.retry(photo()));
    await waitFor(() => expect(result.current.entries.p1?.status).toBe("uploading"));
  });

  it("aborts and forgets a photo removed from the list", async () => {
    const { result } = renderHook(() => useEagerUploads());
    act(() => result.current.sync([photo()]));
    await waitFor(() => expect(result.current.entries.p1?.status).toBe("uploading"));

    act(() => result.current.sync([]));
    expect(result.current.entries.p1).toBeUndefined();
    expect(FakeXhr.instances[0]?.aborted).toBe(true);
  });

  it("does not restart a running upload when only the crop changes", async () => {
    const { result } = renderHook(() => useEagerUploads());
    act(() => result.current.sync([photo()]));
    await waitFor(() => expect(result.current.entries.p1?.status).toBe("uploading"));

    // Re-crop = same id, new rect — the original bytes are immutable.
    act(() => result.current.sync([{ ...photo(), crop: { x: 0, y: 0, width: 10, height: 10 } }]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeXhr.instances).toHaveLength(1);
  });

  it("marks a failed PUT as an error", async () => {
    const { result } = renderHook(() => useEagerUploads());
    act(() => result.current.sync([photo()]));
    await waitFor(() => expect(result.current.entries.p1?.status).toBe("uploading"));

    act(() => FakeXhr.instances[0]?.onerror?.());
    await waitFor(() => expect(result.current.entries.p1?.status).toBe("error"));
    expect(result.current.entries.p1?.error).toBe("Upload failed");
  });
});
