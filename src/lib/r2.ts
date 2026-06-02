// SEAM (phase 04): minimal public-URL builder for R2 object keys.
// Phase 06 (upload & moderation) expands R2 handling with thumb/card key variants
// and a presigned-upload signer; this keeps the duel route able to build image URLs.

import { env } from "@/lib/env";

/** Public CDN URL for an R2 object key (e.g. "seed/mittens.webp"). */
export function publicUrl(key: string): string {
  const base = env.R2_PUBLIC_URL.replace(/\/+$/, "");
  return `${base}/${key}`;
}
