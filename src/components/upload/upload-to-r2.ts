import { sha256HexOfFile } from "@/lib/sha256-file";

type SignResponse = { uploadUrl: string; r2Key: string };

/**
 * Sign an upload, PUT the original bytes straight to R2, return its r2Key.
 * The file's SHA-256 goes with the sign request so duplicates are rejected
 * BEFORE any bytes are uploaded (the server re-hashes at ingest regardless).
 */
export async function uploadToR2(file: File): Promise<{ r2Key: string }> {
  const sha256 = await sha256HexOfFile(file);
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size, sha256 }),
  });
  if (!signRes.ok) {
    const body = (await signRes.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not get upload URL");
  }
  const { uploadUrl, r2Key } = (await signRes.json()) as SignResponse;

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Upload failed");
  }
  return { r2Key };
}
