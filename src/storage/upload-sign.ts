import { createId } from "@paralleldrive/cuid2";

import { presignPut } from "@/lib/r2";
import { originalKey } from "@/storage/keys";

export type UploadSign = {
  uploadUrl: string;
  r2Key: string;
};

/**
 * Mint a fresh CatImage id, build its `original` r2Key, and return a presigned
 * PUT URL the browser uses to upload the original bytes directly to R2.
 * The same id is later reused so derived variants land under cats/<id>/.
 */
export async function buildUploadSign(contentType: string): Promise<UploadSign> {
  const imageId = createId();
  const r2Key = originalKey(imageId);
  const uploadUrl = await presignPut(r2Key, contentType);
  return { uploadUrl, r2Key };
}
