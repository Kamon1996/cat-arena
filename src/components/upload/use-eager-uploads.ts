"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PickedPhoto } from "@/components/upload/image-dropzone";
import { sha256HexOfFile } from "@/lib/sha256-file";

export type EagerUploadStatus = "hashing" | "uploading" | "uploaded" | "error";

export type EagerUpload = {
  status: EagerUploadStatus;
  /** 0–100; advances during the PUT (hashing/signing stay at 0). */
  progress: number;
  r2Key: string | null;
  error: string | null;
};

/** waitAll outcome: every photo's key, or a flag that something still fails. */
export type EagerUploadsResult = { ok: true; keys: Record<string, string> } | { ok: false };

type SignResponse = { uploadUrl: string; r2Key: string };

type Controller = {
  aborted: boolean;
  xhr: XMLHttpRequest | null;
  /** Never rejects — resolves the r2Key, or null on error/abort. */
  done: Promise<string | null>;
};

const PROGRESS_START = 0;
const PROGRESS_DONE = 100;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

class AbortedUpload extends Error {}

function putWithProgress(
  file: File,
  uploadUrl: string,
  controller: Controller,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    controller.xhr = xhr;
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("content-type", file.type);
    // fetch() has no upload-progress events — XHR is the only way to drive
    // the per-tile progress bar (see the file-upload-patterns skill).
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * PROGRESS_DONE));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= HTTP_OK_MIN && xhr.status <= HTTP_OK_MAX) {
        resolve();
      } else {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onabort = () => reject(new AbortedUpload());
    xhr.send(file);
  });
}

/**
 * Eager direct-to-R2 uploads: each photo starts uploading the moment it is
 * picked (hash → sign → presigned PUT), so by the time the user submits the
 * form the bytes are usually already in storage and submit only sends
 * `{r2Key, crop}` references. Duplicates surface per-photo at sign time
 * (HTTP 409), long before the form is filled in.
 *
 * Removing a photo aborts its in-flight upload; an already-uploaded original
 * simply becomes an orphan and is reaped by the cleanup cron. Re-cropping
 * never re-uploads — the original bytes are immutable, only the rect changes.
 */
export function useEagerUploads() {
  const [entries, setEntries] = useState<Record<string, EagerUpload>>({});
  const controllers = useRef(new Map<string, Controller>());

  const patch = useCallback((id: string, partial: Partial<EagerUpload>) => {
    setEntries((prev) => {
      const current = prev[id];
      return current ? { ...prev, [id]: { ...current, ...partial } } : prev;
    });
  }, []);

  const start = useCallback(
    (photo: PickedPhoto) => {
      if (controllers.current.has(photo.id)) {
        return; // already running or finished — re-crops must not re-upload
      }
      const controller: Controller = { aborted: false, xhr: null, done: Promise.resolve(null) };
      controllers.current.set(photo.id, controller);
      setEntries((prev) => ({
        ...prev,
        [photo.id]: { status: "hashing", progress: PROGRESS_START, r2Key: null, error: null },
      }));

      controller.done = (async (): Promise<string | null> => {
        try {
          const sha256 = await sha256HexOfFile(photo.file);
          if (controller.aborted) {
            return null;
          }
          const signRes = await fetch("/api/upload/sign", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contentType: photo.file.type,
              size: photo.file.size,
              sha256,
            }),
          });
          if (!signRes.ok) {
            const body = (await signRes.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? "Could not get upload URL");
          }
          if (controller.aborted) {
            return null;
          }
          const { uploadUrl, r2Key } = (await signRes.json()) as SignResponse;
          patch(photo.id, { status: "uploading" });
          await putWithProgress(photo.file, uploadUrl, controller, (percent) =>
            patch(photo.id, { progress: percent }),
          );
          patch(photo.id, { status: "uploaded", progress: PROGRESS_DONE, r2Key });
          return r2Key;
        } catch (err) {
          if (!(err instanceof AbortedUpload) && !controller.aborted) {
            patch(photo.id, {
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
            });
          }
          return null;
        }
      })();
    },
    [patch],
  );

  const abort = useCallback((id: string) => {
    const controller = controllers.current.get(id);
    if (controller) {
      controller.aborted = true;
      controller.xhr?.abort();
      controllers.current.delete(id);
    }
    setEntries((prev) => {
      if (!(id in prev)) {
        return prev;
      }
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const retry = useCallback(
    (photo: PickedPhoto) => {
      abort(photo.id);
      start(photo);
    },
    [abort, start],
  );

  /** Reconcile with the form's photo list: start new photos, abort removed ones. */
  const sync = useCallback(
    (photos: PickedPhoto[]) => {
      const present = new Set(photos.map((p) => p.id));
      for (const id of controllers.current.keys()) {
        if (!present.has(id)) {
          abort(id);
        }
      }
      for (const photo of photos) {
        start(photo);
      }
    },
    [abort, start],
  );

  /** Await every photo's upload; ok:false when any failed or never started. */
  const waitAll = useCallback(async (ids: string[]): Promise<EagerUploadsResult> => {
    const keys: Record<string, string> = {};
    for (const id of ids) {
      const controller = controllers.current.get(id);
      const r2Key = controller ? await controller.done : null;
      if (!r2Key) {
        return { ok: false };
      }
      keys[id] = r2Key;
    }
    return { ok: true, keys };
  }, []);

  // Leaving the page abandons in-flight PUTs; orphaned originals are reaped
  // by the cleanup cron, so plain aborts are enough here.
  useEffect(() => {
    const all = controllers.current;
    return () => {
      for (const controller of all.values()) {
        controller.aborted = true;
        controller.xhr?.abort();
      }
    };
  }, []);

  return { entries, sync, retry, waitAll };
}
